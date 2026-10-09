#!/usr/bin/env python3
"""Render the actual weaponMeshes/meleeMeshes into transparent Armory cards.

Requires Pillow, Python Playwright and Chromium. This is an isolated asset fixture,
not a game QA fixture: it never starts a game, changes game state, or installs game
input handlers. All 41 assets reuse one context and one GPU buffer.

    python tools/generate-armory-art.py
"""
import argparse
import base64
import io
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
FIXTURE = """<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="art" width="640" height="360" style="width:640px;height:360px"></canvas>
<script type="module">
import {createWeaponPreview,armoryPreviewDiagnostics} from '/voxel-armory-preview.js';
import {WEAPONS} from '/voxel-weapons.js';
import {MELEE_WEAPONS} from '/voxel-melee.js';
import {weaponMeshes,meleeMeshes} from '/voxel-renderer.js';
const canvas=document.querySelector('canvas');
const items=[...Object.values(WEAPONS).map(w=>({id:w.id,name:w.name,kind:'gun'})),
...Object.values(MELEE_WEAPONS).map(w=>({id:w.id,name:w.name,kind:'melee'}))];
const preview=await createWeaponPreview(canvas,{weaponId:items[0].id,kind:'gun',interactive:false,
sceneWidth:2.28,pixelRatio:1,preserveDrawingBuffer:true});
window.armoryArt={items,async render(item){
 preview.setWeapon(item.id,item.kind);
 const mesh=item.kind==='gun'?weaponMeshes(item.id):meleeMeshes({meleeWeapon:item.id});
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<mesh.length;i+=10)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],mesh[i+j]);hi[j]=Math.max(hi[j],mesh[i+j]);}
 const digest=await crypto.subtle.digest('SHA-256',mesh);
 const meshSha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 return {png:canvas.toDataURL('image/png'),vertices:mesh.length/10,meshSha256,bounds:{min:lo,max:hi},
 diagnostics:{...armoryPreviewDiagnostics}};
},finish(){preview.destroy();return {...armoryPreviewDiagnostics};}};
</script></body></html>"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/__armory_art":
            body = FIXTURE.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--contact-sheet", default="/workspace/scratch/armory-contact-sheet.png")
    args = parser.parse_args()
    if os.environ.get("SITES_MANAGED_LINUX_CONTAINER") == "1":
        raise SystemExit("Use the Sites-managed browser for this environment.")
    output = PUBLIC / "art" / "armory"
    output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    records, images = [], []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.chromium, headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            try:
                page = browser.new_page(viewport={"width": 640, "height": 360}, device_scale_factor=1)
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/__armory_art")
                page.wait_for_function("Boolean(window.armoryArt)")
                items = page.evaluate("window.armoryArt.items")
                assert len(items) == 41, f"Expected 36 guns and 5 melee weapons, found {len(items)}"
                for item in items:
                    rendered = page.evaluate("item => window.armoryArt.render(item)", item)
                    image = Image.open(io.BytesIO(base64.b64decode(rendered.pop("png").split(",")[1]))).convert("RGBA")
                    alpha = image.getchannel("A")
                    bounds = alpha.getbbox()
                    assert bounds and alpha.getextrema() == (0, 255), f"Missing transparent geometry: {item['id']}"
                    assert bounds[0] > 1 and bounds[1] > 1 and bounds[2] < 639 and bounds[3] < 359, f"Clipped: {item['id']}"
                    name = ("melee_" if item["kind"] == "melee" else "") + item["id"] + ".webp"
                    image.save(output / name, format="WEBP", lossless=True, method=6)
                    records.append({**item, "file": name, "pixels": [640, 360], "alphaBounds": bounds,
                                    "bytes": (output / name).stat().st_size, **rendered})
                    images.append((item, image))
                final = page.evaluate("window.armoryArt.finish()")
                assert final["activeContexts"] == 0 and final["contextsCreated"] == final["contextsReleased"] == 1, final
                assert not errors, errors
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    (output / "manifest.json").write_text(json.dumps({
        "generator": "tools/generate-armory-art.py", "source": ["public/voxel-renderer.js", "public/voxel-weapons.js", "public/voxel-melee.js"],
        "projection": "orthographic, shared 2.28-metre width; original mesh proportions and colors",
        "transparent": True, "resources": final, "items": records,
    }, indent=2) + "\n")
    columns, cell_width, cell_height = 6, 300, 210
    sheet = Image.new("RGB", (columns * cell_width, ((len(images) + columns - 1) // columns) * cell_height), "#0d151c")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    for index, (item, image) in enumerate(images):
        x, y = index % columns * cell_width, index // columns * cell_height
        draw.rectangle([x + 5, y + 5, x + cell_width - 5, y + cell_height - 5], fill="#1a2630", outline="#364652")
        thumbnail = image.resize((288, 162), Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, (x + 6, y + 8), thumbnail)
        draw.text((x + 14, y + 176), item["name"], font=font, fill="#e6eeed")
        draw.text((x + 14, y + 192), item["id"], font=font, fill="#92a7b7")
    contact = Path(args.contact_sheet)
    contact.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(contact)
    print(json.dumps({"assets": len(records), "guns": sum(i["kind"] == "gun" for i in records), "melee": sum(i["kind"] == "melee" for i in records),
                      "bytes": sum(i["bytes"] for i in records), "contactSheet": str(contact), "resources": final}, indent=2))


if __name__ == "__main__":
    main()
