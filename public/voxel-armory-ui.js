import { weaponStats as lE, weaponDamage as aE, WEAPONS as iE } from "./voxel-weapons.js";
import { meleeComboLength as oE, meleeProfile as rE, MELEE_WEAPONS as uE, MELEE_COMBO_WINDOW_TICKS as sE } from "./voxel-melee.js";
function cE(l, i) {
  for (var r = 0; r < i.length; r++) {
    const s = i[r];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const c in s)
        if (c !== "default" && !(c in l)) {
          const f = Object.getOwnPropertyDescriptor(s, c);
          f && Object.defineProperty(l, c, f.get ? f : {
            enumerable: !0,
            get: () => s[c]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(l, Symbol.toStringTag, { value: "Module" }));
}
function fE(l) {
  return l && l.__esModule && Object.prototype.hasOwnProperty.call(l, "default") ? l.default : l;
}
var hm = { exports: {} }, gu = {};
var kv;
function dE() {
  if (kv) return gu;
  kv = 1;
  var l = /* @__PURE__ */ Symbol.for("react.transitional.element"), i = /* @__PURE__ */ Symbol.for("react.fragment");
  function r(s, c, f) {
    var m = null;
    if (f !== void 0 && (m = "" + f), c.key !== void 0 && (m = "" + c.key), "key" in c) {
      f = {};
      for (var v in c)
        v !== "key" && (f[v] = c[v]);
    } else f = c;
    return c = f.ref, {
      $$typeof: l,
      type: s,
      key: m,
      ref: c !== void 0 ? c : null,
      props: f
    };
  }
  return gu.Fragment = i, gu.jsx = r, gu.jsxs = r, gu;
}
var Xv;
function mE() {
  return Xv || (Xv = 1, hm.exports = dE()), hm.exports;
}
var w = mE(), pm = { exports: {} }, tt = {};
var Kv;
function gE() {
  if (Kv) return tt;
  Kv = 1;
  var l = /* @__PURE__ */ Symbol.for("react.transitional.element"), i = /* @__PURE__ */ Symbol.for("react.portal"), r = /* @__PURE__ */ Symbol.for("react.fragment"), s = /* @__PURE__ */ Symbol.for("react.strict_mode"), c = /* @__PURE__ */ Symbol.for("react.profiler"), f = /* @__PURE__ */ Symbol.for("react.consumer"), m = /* @__PURE__ */ Symbol.for("react.context"), v = /* @__PURE__ */ Symbol.for("react.forward_ref"), y = /* @__PURE__ */ Symbol.for("react.suspense"), h = /* @__PURE__ */ Symbol.for("react.memo"), p = /* @__PURE__ */ Symbol.for("react.lazy"), g = /* @__PURE__ */ Symbol.for("react.activity"), x = /* @__PURE__ */ Symbol.for("react.view_transition"), T = Symbol.iterator;
  function A(O) {
    return O === null || typeof O != "object" ? null : (O = T && O[T] || O["@@iterator"], typeof O == "function" ? O : null);
  }
  var N = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, E = Object.assign, M = {};
  function R(O, B, ce) {
    this.props = O, this.context = B, this.refs = M, this.updater = ce || N;
  }
  R.prototype.isReactComponent = {}, R.prototype.setState = function(O, B) {
    if (typeof O != "object" && typeof O != "function" && O != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, O, B, "setState");
  }, R.prototype.forceUpdate = function(O) {
    this.updater.enqueueForceUpdate(this, O, "forceUpdate");
  };
  function I() {
  }
  I.prototype = R.prototype;
  function C(O, B, ce) {
    this.props = O, this.context = B, this.refs = M, this.updater = ce || N;
  }
  var z = C.prototype = new I();
  z.constructor = C, E(z, R.prototype), z.isPureReactComponent = !0;
  var V = Array.isArray;
  function _() {
  }
  var U = { H: null, A: null, T: null, S: null }, j = Object.prototype.hasOwnProperty;
  function H(O, B, ce) {
    var oe = ce.ref;
    return {
      $$typeof: l,
      type: O,
      key: B,
      ref: oe !== void 0 ? oe : null,
      props: ce
    };
  }
  function q(O, B) {
    return H(O.type, B, O.props);
  }
  function $(O) {
    return typeof O == "object" && O !== null && O.$$typeof === l;
  }
  function Z(O) {
    var B = { "=": "=0", ":": "=2" };
    return "$" + O.replace(/[=:]/g, function(ce) {
      return B[ce];
    });
  }
  var G = /\/+/g;
  function le(O, B) {
    return typeof O == "object" && O !== null && O.key != null ? Z("" + O.key) : B.toString(36);
  }
  function k(O) {
    switch (O.status) {
      case "fulfilled":
        return O.value;
      case "rejected":
        throw O.reason;
      default:
        switch (typeof O.status == "string" ? O.then(_, _) : (O.status = "pending", O.then(
          function(B) {
            O.status === "pending" && (O.status = "fulfilled", O.value = B);
          },
          function(B) {
            O.status === "pending" && (O.status = "rejected", O.reason = B);
          }
        )), O.status) {
          case "fulfilled":
            return O.value;
          case "rejected":
            throw O.reason;
        }
    }
    throw O;
  }
  function ie(O, B, ce, oe, ye) {
    var de = typeof O;
    (de === "undefined" || de === "boolean") && (O = null);
    var Ae = !1;
    if (O === null) Ae = !0;
    else
      switch (de) {
        case "bigint":
        case "string":
        case "number":
          Ae = !0;
          break;
        case "object":
          switch (O.$$typeof) {
            case l:
            case i:
              Ae = !0;
              break;
            case p:
              return Ae = O._init, ie(
                Ae(O._payload),
                B,
                ce,
                oe,
                ye
              );
          }
      }
    if (Ae)
      return ye = ye(O), Ae = oe === "" ? "." + le(O, 0) : oe, V(ye) ? (ce = "", Ae != null && (ce = Ae.replace(G, "$&/") + "/"), ie(ye, B, ce, "", function(Ke) {
        return Ke;
      })) : ye != null && ($(ye) && (ye = q(
        ye,
        ce + (ye.key == null || O && O.key === ye.key ? "" : ("" + ye.key).replace(
          G,
          "$&/"
        ) + "/") + Ae
      )), B.push(ye)), 1;
    Ae = 0;
    var pe = oe === "" ? "." : oe + ":";
    if (V(O))
      for (var xe = 0; xe < O.length; xe++)
        oe = O[xe], de = pe + le(oe, xe), Ae += ie(
          oe,
          B,
          ce,
          de,
          ye
        );
    else if (xe = A(O), typeof xe == "function")
      for (O = xe.call(O), xe = 0; !(oe = O.next()).done; )
        oe = oe.value, de = pe + le(oe, xe++), Ae += ie(
          oe,
          B,
          ce,
          de,
          ye
        );
    else if (de === "object") {
      if (typeof O.then == "function")
        return ie(
          k(O),
          B,
          ce,
          oe,
          ye
        );
      throw B = String(O), Error(
        "Objects are not valid as a React child (found: " + (B === "[object Object]" ? "object with keys {" + Object.keys(O).join(", ") + "}" : B) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Ae;
  }
  function P(O, B, ce) {
    if (O == null) return O;
    var oe = [], ye = 0;
    return ie(O, oe, "", "", function(de) {
      return B.call(ce, de, ye++);
    }), oe;
  }
  function J(O) {
    if (O._status === -1) {
      var B = O._result, ce = B();
      ce.then(
        function(oe) {
          (O._status === 0 || O._status === -1) && (O._status = 1, O._result = oe, ce.status === void 0 && (ce.status = "fulfilled", ce.value = oe));
        },
        function(oe) {
          (O._status === 0 || O._status === -1) && (O._status = 2, O._result = oe, ce.status === void 0 && (ce.status = "rejected", ce.reason = oe));
        }
      ), O._status === -1 && (O._status = 0, O._result = ce);
    }
    if (O._status === 1) return O._result.default;
    throw O._result;
  }
  var te = typeof reportError == "function" ? reportError : function(O) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var B = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof O == "object" && O !== null && typeof O.message == "string" ? String(O.message) : String(O),
        error: O
      });
      if (!window.dispatchEvent(B)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", O);
      return;
    }
    console.error(O);
  };
  function De(O) {
    var B = U.T, ce = {};
    ce.types = B !== null ? B.types : null, U.T = ce;
    try {
      var oe = O(), ye = U.S;
      ye !== null && ye(ce, oe), typeof oe == "object" && oe !== null && typeof oe.then == "function" && oe.then(_, te);
    } catch (de) {
      te(de);
    } finally {
      B !== null && ce.types !== null && (B.types = ce.types), U.T = B;
    }
  }
  function ge(O) {
    var B = U.T;
    if (B !== null) {
      var ce = B.types;
      ce === null ? B.types = [O] : ce.indexOf(O) === -1 && ce.push(O);
    } else De(ge.bind(null, O));
  }
  var ze = {
    map: P,
    forEach: function(O, B, ce) {
      P(
        O,
        function() {
          B.apply(this, arguments);
        },
        ce
      );
    },
    count: function(O) {
      var B = 0;
      return P(O, function() {
        B++;
      }), B;
    },
    toArray: function(O) {
      return P(O, function(B) {
        return B;
      }) || [];
    },
    only: function(O) {
      if (!$(O))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return O;
    }
  };
  return tt.Activity = g, tt.Children = ze, tt.Component = R, tt.Fragment = r, tt.Profiler = c, tt.PureComponent = C, tt.StrictMode = s, tt.Suspense = y, tt.ViewTransition = x, tt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = U, tt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(O) {
      return U.H.useMemoCache(O);
    }
  }, tt.addTransitionType = ge, tt.cache = function(O) {
    return function() {
      return O.apply(null, arguments);
    };
  }, tt.cacheSignal = function() {
    return null;
  }, tt.cloneElement = function(O, B, ce) {
    if (O == null)
      throw Error(
        "The argument must be a React element, but you passed " + O + "."
      );
    var oe = E({}, O.props), ye = O.key;
    if (B != null)
      for (de in B.key !== void 0 && (ye = "" + B.key), B)
        !j.call(B, de) || de === "key" || de === "__self" || de === "__source" || de === "ref" && B.ref === void 0 || (oe[de] = B[de]);
    var de = arguments.length - 2;
    if (de === 1) oe.children = ce;
    else if (1 < de) {
      for (var Ae = Array(de), pe = 0; pe < de; pe++)
        Ae[pe] = arguments[pe + 2];
      oe.children = Ae;
    }
    return H(O.type, ye, oe);
  }, tt.createContext = function(O) {
    return O = {
      $$typeof: m,
      _currentValue: O,
      _currentValue2: O,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, O.Provider = O, O.Consumer = {
      $$typeof: f,
      _context: O
    }, O;
  }, tt.createElement = function(O, B, ce) {
    var oe, ye = {}, de = null;
    if (B != null)
      for (oe in B.key !== void 0 && (de = "" + B.key), B)
        j.call(B, oe) && oe !== "key" && oe !== "__self" && oe !== "__source" && (ye[oe] = B[oe]);
    var Ae = arguments.length - 2;
    if (Ae === 1) ye.children = ce;
    else if (1 < Ae) {
      for (var pe = Array(Ae), xe = 0; xe < Ae; xe++)
        pe[xe] = arguments[xe + 2];
      ye.children = pe;
    }
    if (O && O.defaultProps)
      for (oe in Ae = O.defaultProps, Ae)
        ye[oe] === void 0 && (ye[oe] = Ae[oe]);
    return H(O, de, ye);
  }, tt.createRef = function() {
    return { current: null };
  }, tt.forwardRef = function(O) {
    return { $$typeof: v, render: O };
  }, tt.isValidElement = $, tt.lazy = function(O) {
    return {
      $$typeof: p,
      _payload: { _status: -1, _result: O },
      _init: J
    };
  }, tt.memo = function(O, B) {
    return {
      $$typeof: h,
      type: O,
      compare: B === void 0 ? null : B
    };
  }, tt.startTransition = De, tt.unstable_useCacheRefresh = function() {
    return U.H.useCacheRefresh();
  }, tt.use = function(O) {
    return U.H.use(O);
  }, tt.useActionState = function(O, B, ce) {
    return U.H.useActionState(O, B, ce);
  }, tt.useCallback = function(O, B) {
    return U.H.useCallback(O, B);
  }, tt.useContext = function(O) {
    return U.H.useContext(O);
  }, tt.useDebugValue = function() {
  }, tt.useDeferredValue = function(O, B) {
    return U.H.useDeferredValue(O, B);
  }, tt.useEffect = function(O, B) {
    return U.H.useEffect(O, B);
  }, tt.useEffectEvent = function(O) {
    return U.H.useEffectEvent(O);
  }, tt.useId = function() {
    return U.H.useId();
  }, tt.useImperativeHandle = function(O, B, ce) {
    return U.H.useImperativeHandle(O, B, ce);
  }, tt.useInsertionEffect = function(O, B) {
    return U.H.useInsertionEffect(O, B);
  }, tt.useLayoutEffect = function(O, B) {
    return U.H.useLayoutEffect(O, B);
  }, tt.useMemo = function(O, B) {
    return U.H.useMemo(O, B);
  }, tt.useOptimistic = function(O, B) {
    return U.H.useOptimistic(O, B);
  }, tt.useReducer = function(O, B, ce) {
    return U.H.useReducer(O, B, ce);
  }, tt.useRef = function(O) {
    return U.H.useRef(O);
  }, tt.useState = function(O) {
    return U.H.useState(O);
  }, tt.useSyncExternalStore = function(O, B, ce) {
    return U.H.useSyncExternalStore(
      O,
      B,
      ce
    );
  }, tt.useTransition = function() {
    return U.H.useTransition();
  }, tt.version = "19.3.0", tt;
}
var Pv;
function Mu() {
  return Pv || (Pv = 1, pm.exports = gE()), pm.exports;
}
var b = Mu();
const sy = /* @__PURE__ */ fE(b), hE = /* @__PURE__ */ cE({
  __proto__: null,
  default: sy
}, [b]);
var vm = { exports: {} }, hu = {}, bm = { exports: {} }, ym = {};
var Qv;
function pE() {
  return Qv || (Qv = 1, (function(l) {
    function i(k, ie) {
      var P = k.length;
      k.push(ie);
      e: for (; 0 < P; ) {
        var J = P - 1 >>> 1, te = k[J];
        if (0 < c(te, ie))
          k[J] = ie, k[P] = te, P = J;
        else break e;
      }
    }
    function r(k) {
      return k.length === 0 ? null : k[0];
    }
    function s(k) {
      if (k.length === 0) return null;
      var ie = k[0], P = k.pop();
      if (P !== ie) {
        k[0] = P;
        e: for (var J = 0, te = k.length, De = te >>> 1; J < De; ) {
          var ge = 2 * (J + 1) - 1, ze = k[ge], O = ge + 1, B = k[O];
          if (0 > c(ze, P))
            O < te && 0 > c(B, ze) ? (k[J] = B, k[O] = P, J = O) : (k[J] = ze, k[ge] = P, J = ge);
          else if (O < te && 0 > c(B, P))
            k[J] = B, k[O] = P, J = O;
          else break e;
        }
      }
      return ie;
    }
    function c(k, ie) {
      var P = k.sortIndex - ie.sortIndex;
      return P !== 0 ? P : k.id - ie.id;
    }
    if (l.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var f = performance;
      l.unstable_now = function() {
        return f.now();
      };
    } else {
      var m = Date, v = m.now();
      l.unstable_now = function() {
        return m.now() - v;
      };
    }
    var y = [], h = [], p = 1, g = null, x = 3, T = !1, A = !1, N = !1, E = !1, M = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, I = typeof setImmediate < "u" ? setImmediate : null;
    function C(k) {
      for (var ie = r(h); ie !== null; ) {
        if (ie.callback === null) s(h);
        else if (ie.startTime <= k)
          s(h), ie.sortIndex = ie.expirationTime, i(y, ie);
        else break;
        ie = r(h);
      }
    }
    function z(k) {
      if (N = !1, C(k), !A)
        if (r(y) !== null)
          A = !0, V || (V = !0, $());
        else {
          var ie = r(h);
          ie !== null && le(z, ie.startTime - k);
        }
    }
    var V = !1, _ = -1, U = 5, j = -1;
    function H() {
      return E ? !0 : !(l.unstable_now() - j < U);
    }
    function q() {
      if (E = !1, V) {
        var k = l.unstable_now();
        j = k;
        var ie = !0;
        try {
          e: {
            A = !1, N && (N = !1, R(_), _ = -1), T = !0;
            var P = x;
            try {
              t: {
                for (C(k), g = r(y); g !== null && !(g.expirationTime > k && H()); ) {
                  var J = g.callback;
                  if (typeof J == "function") {
                    g.callback = null, x = g.priorityLevel;
                    var te = J(
                      g.expirationTime <= k
                    );
                    if (k = l.unstable_now(), typeof te == "function") {
                      g.callback = te, C(k), ie = !0;
                      break t;
                    }
                    g === r(y) && s(y), C(k);
                  } else s(y);
                  g = r(y);
                }
                if (g !== null) ie = !0;
                else {
                  var De = r(h);
                  De !== null && le(
                    z,
                    De.startTime - k
                  ), ie = !1;
                }
              }
              break e;
            } finally {
              g = null, x = P, T = !1;
            }
            ie = void 0;
          }
        } finally {
          ie ? $() : V = !1;
        }
      }
    }
    var $;
    if (typeof I == "function")
      $ = function() {
        I(q);
      };
    else if (typeof MessageChannel < "u") {
      var Z = new MessageChannel(), G = Z.port2;
      Z.port1.onmessage = q, $ = function() {
        G.postMessage(null);
      };
    } else
      $ = function() {
        M(q, 0);
      };
    function le(k, ie) {
      _ = M(function() {
        k(l.unstable_now());
      }, ie);
    }
    l.unstable_IdlePriority = 5, l.unstable_ImmediatePriority = 1, l.unstable_LowPriority = 4, l.unstable_NormalPriority = 3, l.unstable_Profiling = null, l.unstable_UserBlockingPriority = 2, l.unstable_cancelCallback = function(k) {
      k.callback = null;
    }, l.unstable_forceFrameRate = function(k) {
      0 > k || 125 < k ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : U = 0 < k ? Math.floor(1e3 / k) : 5;
    }, l.unstable_getCurrentPriorityLevel = function() {
      return x;
    }, l.unstable_next = function(k) {
      switch (x) {
        case 1:
        case 2:
        case 3:
          var ie = 3;
          break;
        default:
          ie = x;
      }
      var P = x;
      x = ie;
      try {
        return k();
      } finally {
        x = P;
      }
    }, l.unstable_requestPaint = function() {
      E = !0;
    }, l.unstable_runWithPriority = function(k, ie) {
      switch (k) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          k = 3;
      }
      var P = x;
      x = k;
      try {
        return ie();
      } finally {
        x = P;
      }
    }, l.unstable_scheduleCallback = function(k, ie, P) {
      var J = l.unstable_now();
      switch (typeof P == "object" && P !== null ? (P = P.delay, P = typeof P == "number" && 0 < P ? J + P : J) : P = J, k) {
        case 1:
          var te = -1;
          break;
        case 2:
          te = 250;
          break;
        case 5:
          te = 1073741823;
          break;
        case 4:
          te = 1e4;
          break;
        default:
          te = 5e3;
      }
      return te = P + te, k = {
        id: p++,
        callback: ie,
        priorityLevel: k,
        startTime: P,
        expirationTime: te,
        sortIndex: -1
      }, P > J ? (k.sortIndex = P, i(h, k), r(y) === null && k === r(h) && (N ? (R(_), _ = -1) : N = !0, le(z, P - J))) : (k.sortIndex = te, i(y, k), A || T || (A = !0, V || (V = !0, $()))), k;
    }, l.unstable_shouldYield = H, l.unstable_wrapCallback = function(k) {
      var ie = x;
      return function() {
        var P = x;
        x = ie;
        try {
          return k.apply(this, arguments);
        } finally {
          x = P;
        }
      };
    };
  })(ym)), ym;
}
var Zv;
function vE() {
  return Zv || (Zv = 1, bm.exports = pE()), bm.exports;
}
var xm = { exports: {} }, Jn = {};
var Fv;
function bE() {
  if (Fv) return Jn;
  Fv = 1;
  var l = Mu();
  function i(p) {
    var g = "https://react.dev/errors/" + p;
    if (1 < arguments.length) {
      g += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var x = 2; x < arguments.length; x++)
        g += "&args[]=" + encodeURIComponent(arguments[x]);
    }
    return "Minified React error #" + p + "; visit " + g + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function r() {
  }
  var s = {
    d: {
      f: r,
      r: function() {
        throw Error(i(522));
      },
      D: r,
      C: r,
      L: r,
      m: r,
      X: r,
      S: r,
      M: r
    },
    p: 0,
    findDOMNode: null
  }, c = /* @__PURE__ */ Symbol.for("react.portal"), f = /* @__PURE__ */ Symbol.for("react.recoverable"), m = /* @__PURE__ */ Symbol.for("react.optimistic_key");
  function v(p, g, x) {
    var T = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: c,
      key: T == null ? null : T === m ? m : "" + T,
      children: p,
      containerInfo: g,
      implementation: x
    };
  }
  var y = l.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function h(p, g) {
    if (p === "font") return "";
    if (typeof g == "string")
      return g === "use-credentials" ? g : "";
  }
  return Jn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = s, Jn.browser = function(p) {
    return { $$typeof: f, _reason: p };
  }, Jn.createPortal = function(p, g) {
    var x = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!g || g.nodeType !== 1 && g.nodeType !== 9 && g.nodeType !== 11)
      throw Error(i(299));
    return v(p, g, null, x);
  }, Jn.flushSync = function(p) {
    var g = y.T, x = s.p;
    try {
      if (y.T = null, s.p = 2, p) return p();
    } finally {
      y.T = g, s.p = x, s.d.f();
    }
  }, Jn.preconnect = function(p, g) {
    typeof p == "string" && (g ? (g = g.crossOrigin, g = typeof g == "string" ? g === "use-credentials" ? g : "" : void 0) : g = null, s.d.C(p, g));
  }, Jn.prefetchDNS = function(p) {
    typeof p == "string" && s.d.D(p);
  }, Jn.preinit = function(p, g) {
    if (typeof p == "string" && g && typeof g.as == "string") {
      var x = g.as, T = h(x, g.crossOrigin), A = typeof g.integrity == "string" ? g.integrity : void 0, N = typeof g.fetchPriority == "string" ? g.fetchPriority : void 0;
      x === "style" ? s.d.S(
        p,
        typeof g.precedence == "string" ? g.precedence : void 0,
        {
          crossOrigin: T,
          integrity: A,
          fetchPriority: N
        }
      ) : x === "script" && s.d.X(p, {
        crossOrigin: T,
        integrity: A,
        fetchPriority: N,
        nonce: typeof g.nonce == "string" ? g.nonce : void 0
      });
    }
  }, Jn.preinitModule = function(p, g) {
    if (typeof p == "string")
      if (typeof g == "object" && g !== null) {
        if (g.as == null || g.as === "script") {
          var x = h(
            g.as,
            g.crossOrigin
          );
          s.d.M(p, {
            crossOrigin: x,
            integrity: typeof g.integrity == "string" ? g.integrity : void 0,
            nonce: typeof g.nonce == "string" ? g.nonce : void 0,
            fetchPriority: typeof g.fetchPriority == "string" ? g.fetchPriority : void 0
          });
        }
      } else g == null && s.d.M(p);
  }, Jn.preload = function(p, g) {
    if (typeof p == "string" && typeof g == "object" && g !== null && typeof g.as == "string") {
      var x = g.as, T = h(x, g.crossOrigin);
      s.d.L(p, x, {
        crossOrigin: T,
        integrity: typeof g.integrity == "string" ? g.integrity : void 0,
        nonce: typeof g.nonce == "string" ? g.nonce : void 0,
        type: typeof g.type == "string" ? g.type : void 0,
        fetchPriority: typeof g.fetchPriority == "string" ? g.fetchPriority : void 0,
        referrerPolicy: typeof g.referrerPolicy == "string" ? g.referrerPolicy : void 0,
        imageSrcSet: typeof g.imageSrcSet == "string" ? g.imageSrcSet : void 0,
        imageSizes: typeof g.imageSizes == "string" ? g.imageSizes : void 0,
        media: typeof g.media == "string" ? g.media : void 0
      });
    }
  }, Jn.preloadModule = function(p, g) {
    if (typeof p == "string")
      if (g) {
        var x = h(g.as, g.crossOrigin);
        s.d.m(p, {
          as: typeof g.as == "string" && g.as !== "script" ? g.as : void 0,
          crossOrigin: x,
          integrity: typeof g.integrity == "string" ? g.integrity : void 0,
          nonce: typeof g.nonce == "string" ? g.nonce : void 0,
          fetchPriority: typeof g.fetchPriority == "string" ? g.fetchPriority : void 0
        });
      } else s.d.m(p);
  }, Jn.requestFormReset = function(p) {
    s.d.r(p);
  }, Jn.unstable_batchedUpdates = function(p, g) {
    return p(g);
  }, Jn.useFormState = function(p, g, x) {
    return y.H.useFormState(p, g, x);
  }, Jn.useFormStatus = function() {
    return y.H.useHostTransitionStatus();
  }, Jn.version = "19.3.0", Jn;
}
var Jv;
function cy() {
  if (Jv) return xm.exports;
  Jv = 1;
  function l() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(l);
      } catch (i) {
        console.error(i);
      }
  }
  return l(), xm.exports = bE(), xm.exports;
}
var $v;
function yE() {
  if ($v) return hu;
  $v = 1;
  var l = vE(), i = Mu(), r = cy();
  function s(e) {
    var t = "https://react.dev/errors/" + e;
    if (1 < arguments.length) {
      t += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var n = 2; n < arguments.length; n++)
        t += "&args[]=" + encodeURIComponent(arguments[n]);
    }
    return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function c(e) {
    return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
  }
  function f(e) {
    for (var t = e, n = t; n && !n.alternate; )
      t = n, (t.flags & 4098) !== 0 && (e = t.return), n = t.return;
    for (; t.return; ) t = t.return;
    return t.tag === 3 ? e : null;
  }
  function m(e) {
    if (e.tag === 13) {
      var t = e.memoizedState;
      if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
    }
    return null;
  }
  function v(e) {
    if (e.tag === 31) {
      var t = e.memoizedState;
      if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
    }
    return null;
  }
  function y(e) {
    if (f(e) !== e)
      throw Error(s(188));
  }
  function h(e) {
    var t = e.alternate;
    if (!t) {
      if (t = f(e), t === null) throw Error(s(188));
      return t !== e ? null : e;
    }
    for (var n = e, a = t; ; ) {
      var o = n.return;
      if (o === null) break;
      var u = o.alternate;
      if (u === null) {
        if (a = o.return, a !== null) {
          n = a;
          continue;
        }
        break;
      }
      if (o.child === u.child) {
        for (u = o.child; u; ) {
          if (u === n) return y(o), e;
          if (u === a) return y(o), t;
          u = u.sibling;
        }
        throw Error(s(188));
      }
      if (n.return !== a.return) n = o, a = u;
      else {
        for (var d = !1, S = o.child; S; ) {
          if (S === n) {
            d = !0, n = o, a = u;
            break;
          }
          if (S === a) {
            d = !0, a = o, n = u;
            break;
          }
          S = S.sibling;
        }
        if (!d) {
          for (S = u.child; S; ) {
            if (S === n) {
              d = !0, n = u, a = o;
              break;
            }
            if (S === a) {
              d = !0, a = u, n = o;
              break;
            }
            S = S.sibling;
          }
          if (!d) throw Error(s(189));
        }
      }
      if (n.alternate !== a) throw Error(s(190));
    }
    if (n.tag !== 3) throw Error(s(188));
    return n.stateNode.current === n ? e : t;
  }
  function p(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e;
    for (e = e.child; e !== null; ) {
      if (t = p(e), t !== null) return t;
      e = e.sibling;
    }
    return null;
  }
  function g(e, t, n, a, o, u) {
    for (; e !== null; ) {
      if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, a, o, u) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && g(
        e.child,
        t,
        n,
        a,
        o,
        u
      ))
        return !0;
      e = e.sibling;
    }
    return !1;
  }
  function x(e) {
    for (e = e.return; e !== null; ) {
      if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
      e = e.return;
    }
    return null;
  }
  function T(e) {
    var t = !1;
    for (e = e.return; e !== null && (e.tag === 4 && (t = !0), !(e.tag === 3 || e.tag === 5 || e.tag === 27)); )
      e = e.return;
    return t;
  }
  function A(e) {
    var t = [null, null], n = x(e);
    return n === null || N(
      t,
      e,
      n.child,
      { foundSelf: !1 }
    ), t;
  }
  function N(e, t, n, a) {
    for (; n !== null; ) {
      if (n === t) a.foundSelf = !0;
      else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
        if (a.foundSelf) return e[1] = n, !0;
        e[0] = n;
      } else if ((n.tag !== 22 || n.memoizedState === null) && N(
        e,
        t,
        n.child,
        a
      ))
        return !0;
      n = n.sibling;
    }
    return !1;
  }
  function E(e) {
    switch (e.tag) {
      case 5:
      case 27:
      case 6:
        return e.stateNode;
      case 3:
        return e.stateNode.containerInfo;
      default:
        throw Error(s(559));
    }
  }
  var M = null, R = null;
  function I(e, t, n) {
    return e === n ? !0 : e === t ? (M = e, !0) : !1;
  }
  function C(e, t, n) {
    return e === n ? (R = e, !1) : e === t ? (R !== null && (M = e), !0) : !1;
  }
  function z(e) {
    if (e === null) return null;
    do
      e = e === null ? null : e.return;
    while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
    return e || null;
  }
  function V(e, t, n) {
    for (var a = 0, o = e; o; o = n(o)) a++;
    o = 0;
    for (var u = t; u; u = n(u)) o++;
    for (; 0 < a - o; ) e = n(e), a--;
    for (; 0 < o - a; ) t = n(t), o--;
    for (; a--; ) {
      if (e === t || t !== null && e === t.alternate)
        return e;
      e = n(e), t = n(t);
    }
    return null;
  }
  var _ = Object.assign, U = /* @__PURE__ */ Symbol.for("react.element"), j = /* @__PURE__ */ Symbol.for("react.transitional.element"), H = /* @__PURE__ */ Symbol.for("react.portal"), q = /* @__PURE__ */ Symbol.for("react.fragment"), $ = /* @__PURE__ */ Symbol.for("react.strict_mode"), Z = /* @__PURE__ */ Symbol.for("react.profiler"), G = /* @__PURE__ */ Symbol.for("react.consumer"), le = /* @__PURE__ */ Symbol.for("react.context"), k = /* @__PURE__ */ Symbol.for("react.forward_ref"), ie = /* @__PURE__ */ Symbol.for("react.suspense"), P = /* @__PURE__ */ Symbol.for("react.suspense_list"), J = /* @__PURE__ */ Symbol.for("react.memo"), te = /* @__PURE__ */ Symbol.for("react.lazy"), De = /* @__PURE__ */ Symbol.for("react.activity"), ge = /* @__PURE__ */ Symbol.for("react.legacy_hidden"), ze = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), O = /* @__PURE__ */ Symbol.for("react.view_transition"), B = /* @__PURE__ */ Symbol.for("react.recoverable"), ce = Symbol.iterator;
  function oe(e) {
    return e === null || typeof e != "object" ? null : (e = ce && e[ce] || e["@@iterator"], typeof e == "function" ? e : null);
  }
  var ye = /* @__PURE__ */ Symbol.for("react.client.reference");
  function de(e) {
    if (e == null) return null;
    if (typeof e == "function")
      return e.$$typeof === ye ? null : e.displayName || e.name || null;
    if (typeof e == "string") return e;
    switch (e) {
      case q:
        return "Fragment";
      case Z:
        return "Profiler";
      case $:
        return "StrictMode";
      case ie:
        return "Suspense";
      case P:
        return "SuspenseList";
      case De:
        return "Activity";
      case O:
        return "ViewTransition";
    }
    if (typeof e == "object")
      switch (e.$$typeof) {
        case H:
          return "Portal";
        case le:
          return e.displayName || "Context";
        case G:
          return (e._context.displayName || "Context") + ".Consumer";
        case k:
          var t = e.render;
          return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
        case J:
          return t = e.displayName || null, t !== null ? t : de(e.type) || "Memo";
        case te:
          t = e._payload, e = e._init;
          try {
            return de(e(t));
          } catch {
          }
      }
    return null;
  }
  var Ae = Array.isArray, pe = i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, xe = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Ke = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, Ue = [], Le = -1;
  function Se(e) {
    return { current: e };
  }
  function be(e) {
    0 > Le || (e.current = Ue[Le], Ue[Le] = null, Le--);
  }
  function Ne(e, t) {
    Le++, Ue[Le] = e.current, e.current = t;
  }
  var Ee = Se(null), Ye = Se(null), re = Se(null), Me = Se(null);
  function je(e, t) {
    switch (Ne(re, t), Ne(Ye, e), Ne(Ee, null), t.nodeType) {
      case 9:
      case 11:
        e = (e = t.documentElement) && (e = e.namespaceURI) ? Wp(e) : 0;
        break;
      default:
        if (e = t.tagName, t = t.namespaceURI)
          t = Wp(t), e = ev(t, e);
        else
          switch (e) {
            case "svg":
              e = 1;
              break;
            case "math":
              e = 2;
              break;
            default:
              e = 0;
          }
    }
    be(Ee), Ne(Ee, e);
  }
  function Pe() {
    be(Ee), be(Ye), be(re);
  }
  function ne(e) {
    var t = e.memoizedState;
    t !== null && (dr._currentValue = t.memoizedState, Ne(Me, e)), t = Ee.current;
    var n = ev(t, e.type);
    t !== n && (Ne(Ye, e), Ne(Ee, n));
  }
  function ae(e) {
    Ye.current === e && (be(Ee), be(Ye)), Me.current === e && (be(Me), dr._currentValue = Ke);
  }
  var He, Ce;
  function Oe(e) {
    if (He === void 0)
      try {
        throw Error();
      } catch (n) {
        var t = n.stack.trim().match(/\n( *(at )?)/);
        He = t && t[1] || "", Ce = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + He + e + Ce;
  }
  var St = !1;
  function Ct(e, t) {
    if (!e || St) return "";
    St = !0;
    var n = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var a = {
        DetermineComponentFrameRoot: function() {
          try {
            if (t) {
              var se = function() {
                throw Error();
              };
              if (Object.defineProperty(se.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(se, []);
                } catch (we) {
                  var Y = we;
                }
                Reflect.construct(e, [], se);
              } else {
                try {
                  se.call();
                } catch (we) {
                  Y = we;
                }
                se = !1;
                try {
                  var F = Object.getOwnPropertyDescriptor(
                    e.prototype,
                    "props"
                  );
                  Object.defineProperty(e.prototype, "props", {
                    configurable: !0,
                    set: function() {
                      throw Error();
                    }
                  }), se = !0, new e();
                } finally {
                  se && (F !== void 0 ? Object.defineProperty(e.prototype, "props", F) : delete e.prototype.props);
                }
              }
            } else {
              try {
                throw Error();
              } catch (we) {
                Y = we;
              }
              (se = e()) && typeof se.catch == "function" && se.catch(function() {
              });
            }
          } catch (we) {
            if (we && Y && typeof we.stack == "string")
              return [we.stack, Y.stack];
          }
          return [null, null];
        }
      };
      a.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var o = Object.getOwnPropertyDescriptor(
        a.DetermineComponentFrameRoot,
        "name"
      );
      o && o.configurable && Object.defineProperty(
        a.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var u = a.DetermineComponentFrameRoot(), d = u[0], S = u[1];
      if (d && S) {
        var D = d.split(`
`), K = S.split(`
`);
        for (o = a = 0; a < D.length && !D[a].includes("DetermineComponentFrameRoot"); )
          a++;
        for (; o < K.length && !K[o].includes(
          "DetermineComponentFrameRoot"
        ); )
          o++;
        if (a === D.length || o === K.length)
          for (a = D.length - 1, o = K.length - 1; 1 <= a && 0 <= o && D[a] !== K[o]; )
            o--;
        for (; 1 <= a && 0 <= o; a--, o--)
          if (D[a] !== K[o]) {
            if (a !== 1 || o !== 1)
              do
                if (a--, o--, 0 > o || D[a] !== K[o]) {
                  var ee = `
` + D[a].replace(" at new ", " at ");
                  return e.displayName && ee.includes("<anonymous>") && (ee = ee.replace("<anonymous>", e.displayName)), ee;
                }
              while (1 <= a && 0 <= o);
            break;
          }
      }
    } finally {
      St = !1, Error.prepareStackTrace = n;
    }
    return (n = e ? e.displayName || e.name : "") ? Oe(n) : "";
  }
  function At(e, t) {
    switch (e.tag) {
      case 26:
      case 27:
      case 5:
        return Oe(e.type);
      case 16:
        return Oe("Lazy");
      case 13:
        return e.child !== t && t !== null ? Oe("Suspense Fallback") : Oe("Suspense");
      case 19:
        return Oe("SuspenseList");
      case 0:
      case 15:
        return Ct(e.type, !1);
      case 11:
        return Ct(e.type.render, !1);
      case 1:
        return Ct(e.type, !0);
      case 31:
        return Oe("Activity");
      case 30:
        return Oe("ViewTransition");
      default:
        return "";
    }
  }
  function ft(e) {
    try {
      var t = "", n = null;
      do
        t += At(e, n), n = e, e = e.return;
      while (e);
      return t;
    } catch (a) {
      return `
Error generating stack: ` + a.message + `
` + a.stack;
    }
  }
  var Wn = Object.prototype.hasOwnProperty, ql = l.unstable_scheduleCallback, yl = l.unstable_cancelCallback, el = l.unstable_shouldYield, Wl = l.unstable_requestPaint, Zt = l.unstable_now, tl = l.unstable_getCurrentPriorityLevel, Tn = l.unstable_ImmediatePriority, $t = l.unstable_UserBlockingPriority, Bt = l.unstable_NormalPriority, ma = l.unstable_LowPriority, en = l.unstable_IdlePriority, nt = l.log, Rt = l.unstable_setDisableYieldValue, Ot = null, dt = null;
  function lt(e) {
    if (typeof nt == "function" && Rt(e), dt && typeof dt.setStrictMode == "function")
      try {
        dt.setStrictMode(Ot, e);
      } catch {
      }
  }
  var pt = Math.clz32 ? Math.clz32 : dl, jt = Math.log, at = Math.LN2;
  function dl(e) {
    return e >>>= 0, e === 0 ? 32 : 31 - (jt(e) / at | 0) | 0;
  }
  var sn = 256, An = 262144, vt = 4194304;
  function nl(e) {
    var t = e & 42;
    if (t !== 0) return t;
    switch (e & -e) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return e & -e;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return e & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return e & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return e;
    }
  }
  function ut(e, t, n) {
    var a = e.pendingLanes;
    if (a === 0) return 0;
    var o = 0, u = e.suspendedLanes, d = e.pingedLanes;
    e = e.warmLanes;
    var S = a & 134217727;
    return S !== 0 ? (a = S & ~u, a !== 0 ? o = nl(a) : (d &= S, d !== 0 ? o = nl(d) : n || (n = S & ~e, n !== 0 && (o = nl(n))))) : (S = a & ~u, S !== 0 ? o = nl(S) : d !== 0 ? o = nl(d) : n || (n = a & ~e, n !== 0 && (o = nl(n)))), o === 0 ? 0 : t !== 0 && t !== o && (t & u) === 0 && (u = o & -o, n = t & -t, u >= n || u === 32 && (n & 4194048) !== 0) ? t : o;
  }
  function ml(e, t) {
    return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
  }
  function Nl(e, t) {
    (t & 8) !== 0 && (t |= t & 32);
    var n = e.entangledLanes;
    if (n !== 0)
      for (e = e.entanglements, n &= t; 0 < n; ) {
        var a = 31 - pt(n), o = 1 << a;
        t |= e[a], n &= ~o;
      }
    return t;
  }
  function _n(e, t) {
    switch (e) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return t + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function On() {
    var e = vt;
    return vt <<= 1, (vt & 62914560) === 0 && (vt = 4194304), e;
  }
  function Ia(e) {
    for (var t = [], n = 0; 31 > n; n++) t.push(e);
    return t;
  }
  function ll(e, t) {
    e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
  }
  function Va(e, t, n, a, o, u) {
    var d = e.pendingLanes;
    e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
    var S = e.entanglements, D = e.expirationTimes, K = e.hiddenUpdates;
    for (n = d & ~n; 0 < n; ) {
      var ee = 31 - pt(n), se = 1 << ee;
      S[ee] = 0, D[ee] = -1;
      var Y = K[ee];
      if (Y !== null)
        for (K[ee] = null, ee = 0; ee < Y.length; ee++) {
          var F = Y[ee];
          F !== null && (F.lane &= -536870913);
        }
      n &= ~se;
    }
    a !== 0 && al(e, a, 0), u !== 0 && o === 0 && e.tag !== 0 && (e.suspendedLanes |= u & ~(d & ~t));
  }
  function al(e, t, n) {
    e.pendingLanes |= t, e.suspendedLanes &= ~t;
    var a = 31 - pt(t);
    e.entangledLanes |= t, e.entanglements[a] = e.entanglements[a] | 1073741824 | n & 261930;
  }
  function Gl(e, t) {
    var n = e.entangledLanes |= t;
    for (e = e.entanglements; n; ) {
      var a = 31 - pt(n), o = 1 << a;
      o & t | e[a] & t && (e[a] |= t), n &= ~o;
    }
  }
  function tn(e, t) {
    var n = t & -t;
    return n = (n & 42) !== 0 ? 1 : Ie(n), (n & (e.suspendedLanes | t)) !== 0 ? 0 : n;
  }
  function Ie(e) {
    switch (e) {
      case 2:
        e = 1;
        break;
      case 8:
        e = 4;
        break;
      case 32:
        e = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        e = 128;
        break;
      case 268435456:
        e = 134217728;
        break;
      default:
        e = 0;
    }
    return e;
  }
  function wn(e) {
    return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function xl() {
    var e = xe.p;
    return e !== 0 ? e : (e = window.event, e === void 0 ? 32 : Iv(e.type));
  }
  function La(e, t) {
    var n = xe.p;
    try {
      return xe.p = e, t();
    } finally {
      xe.p = n;
    }
  }
  var nn = Math.random().toString(36).slice(2), Xt = "__reactFiber$" + nn, Mn = "__reactProps$" + nn, jn = "__reactContainer$" + nn, gi = "__reactEvents$" + nn, Yl = "__reactListeners$" + nn, ea = "__reactHandles$" + nn, ga = "__reactResources$" + nn, Ft = "__reactMarker$" + nn, Hn = "__reactLoad$" + nn;
  function hi(e) {
    delete e[Xt], delete e[Mn], delete e[Yl], delete e[ea];
  }
  function Sl(e) {
    var t;
    if (t = e[Xt]) return t;
    for (var n = e.parentNode; n; ) {
      if (t = n[jn] || n[Xt]) {
        if (n = t.alternate, t.child !== null || n !== null && n.child !== null)
          for (e = vv(e); e !== null; ) {
            if (n = e[Xt]) return n;
            e = vv(e);
          }
        return t;
      }
      e = n, n = e.parentNode;
    }
    return null;
  }
  function Ba(e) {
    if (e = e[Xt] || e[jn]) {
      var t = e.tag;
      if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3)
        return e;
    }
    return null;
  }
  function W(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
    throw Error(s(33));
  }
  function fe(e) {
    var t = e[ga];
    return t || (t = e[ga] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), t;
  }
  function me(e) {
    e[Ft] = !0;
  }
  function Be(e) {
    e[Hn] = void 0;
  }
  var Qe = /* @__PURE__ */ new Set(), qe = {};
  function Ze(e, t) {
    Nt(e, t), Nt(e + "Capture", t);
  }
  function Nt(e, t) {
    for (qe[e] = t, e = 0; e < t.length; e++)
      Qe.add(t[e]);
  }
  var wt = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), ke = {}, Fe = {};
  function ct(e) {
    return Wn.call(Fe, e) ? !0 : Wn.call(ke, e) ? !1 : wt.test(e) ? Fe[e] = !0 : (ke[e] = !0, !1);
  }
  var Xe = !1;
  function gn() {
    var e = Xe;
    return Xe = !1, e;
  }
  function Jt(e, t, n) {
    if (ct(t))
      if (n === null) e.removeAttribute(t);
      else {
        switch (typeof n) {
          case "undefined":
          case "function":
          case "symbol":
            e.removeAttribute(t);
            return;
          case "boolean":
            var a = t.toLowerCase().slice(0, 5);
            if (a !== "data-" && a !== "aria-") {
              e.removeAttribute(t);
              return;
            }
        }
        e.setAttribute(t, n);
      }
  }
  function Un(e, t, n) {
    if (n === null) e.removeAttribute(t);
    else {
      switch (typeof n) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(t);
          return;
      }
      e.setAttribute(t, n);
    }
  }
  function cn(e, t, n, a) {
    if (a === null) e.removeAttribute(n);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(n);
          return;
      }
      e.setAttributeNS(t, n, a);
    }
  }
  function ln(e) {
    switch (typeof e) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return e;
      case "object":
        return e;
      default:
        return "";
    }
  }
  function qa(e) {
    var t = e.type;
    return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
  }
  function Ji(e, t, n) {
    var a = Object.getOwnPropertyDescriptor(
      e.constructor.prototype,
      t
    );
    if (!e.hasOwnProperty(t) && typeof a < "u" && typeof a.get == "function" && typeof a.set == "function") {
      var o = a.get, u = a.set;
      return Object.defineProperty(e, t, {
        configurable: !0,
        get: function() {
          return o.call(this);
        },
        set: function(d) {
          n = "" + d, u.call(this, d);
        }
      }), Object.defineProperty(e, t, {
        enumerable: a.enumerable
      }), {
        getValue: function() {
          return n;
        },
        setValue: function(d) {
          n = "" + d;
        },
        stopTracking: function() {
          e._valueTracker = null, delete e[t];
        }
      };
    }
  }
  function ta(e) {
    if (!e._valueTracker) {
      var t = qa(e) ? "checked" : "value";
      e._valueTracker = Ji(
        e,
        t,
        "" + e[t]
      );
    }
  }
  function Ga(e) {
    if (!e) return !1;
    var t = e._valueTracker;
    if (!t) return !0;
    var n = t.getValue(), a = "";
    return e && (a = qa(e) ? e.checked ? "true" : "false" : e.value), e = a, e !== n ? (t.setValue(e), !0) : !1;
  }
  var $i = /[\n"\\]/g;
  function qt(e) {
    return e.replace(
      $i,
      function(t) {
        return "\\" + t.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function Nn(e, t, n, a, o, u, d, S) {
    e.name = "", d != null && typeof d != "function" && typeof d != "symbol" && typeof d != "boolean" ? e.type = d : e.removeAttribute("type"), t != null ? d === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + ln(t)) : e.value !== "" + ln(t) && (e.value = "" + ln(t)) : d !== "submit" && d !== "reset" || e.removeAttribute("value"), t != null ? d === "number" && e.value == t ? na(e, ln(e.value)) : na(e, ln(t)) : n != null ? na(e, ln(n)) : a != null && e.removeAttribute("value"), o == null && u != null && (e.defaultChecked = !!u), o != null && (e.checked = o && typeof o != "function" && typeof o != "symbol"), S != null && typeof S != "function" && typeof S != "symbol" && typeof S != "boolean" ? e.name = "" + ln(S) : e.removeAttribute("name");
  }
  function ha(e, t, n, a, o, u, d, S) {
    if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (e.type = u), t != null || n != null) {
      if (!(u !== "submit" && u !== "reset" || t != null)) {
        ta(e);
        return;
      }
      n = n != null ? "" + ln(n) : "", t = t != null ? "" + ln(t) : n, S || t === e.value || (e.value = t), e.defaultValue = t;
    }
    a = a ?? o, a = typeof a != "function" && typeof a != "symbol" && !!a, e.checked = S ? e.checked : !!a, e.defaultChecked = !!a, d != null && typeof d != "function" && typeof d != "symbol" && typeof d != "boolean" && (e.name = d), ta(e);
  }
  function na(e, t) {
    e.defaultValue !== "" + t && (e.defaultValue = "" + t);
  }
  function Xn(e, t, n, a) {
    if (e = e.options, t) {
      t = {};
      for (var o = 0; o < n.length; o++)
        t["$" + n[o]] = !0;
      for (n = 0; n < e.length; n++)
        o = t.hasOwnProperty("$" + e[n].value), e[n].selected !== o && (e[n].selected = o), o && a && (e[n].defaultSelected = !0);
    } else {
      for (n = "" + ln(n), t = null, o = 0; o < e.length; o++) {
        if (e[o].value === n) {
          e[o].selected = !0, a && (e[o].defaultSelected = !0);
          return;
        }
        t !== null || e[o].disabled || (t = e[o]);
      }
      t !== null && (t.selected = !0);
    }
  }
  function la(e, t, n) {
    if (t != null && (t = "" + ln(t), t !== e.value && (e.value = t), n == null)) {
      e.defaultValue !== t && (e.defaultValue = t);
      return;
    }
    e.defaultValue = n != null ? "" + ln(n) : "";
  }
  function il(e, t, n, a) {
    if (t == null) {
      if (a != null) {
        if (n != null) throw Error(s(92));
        if (Ae(a)) {
          if (1 < a.length) throw Error(s(93));
          a = a[0];
        }
        n = a;
      }
      n == null && (n = ""), t = n;
    }
    n = ln(t), e.defaultValue = n, a = e.textContent, a === n && a !== "" && a !== null && (e.value = a), ta(e);
  }
  function pn(e, t) {
    if (t) {
      var n = e.firstChild;
      if (n && n === e.lastChild && n.nodeType === 3) {
        n.nodeValue = t;
        return;
      }
    }
    e.textContent = t;
  }
  var aa = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function pa(e, t, n) {
    var a = t.indexOf("--") === 0;
    n == null || typeof n == "boolean" || n === "" ? a ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : a ? e.setProperty(t, n) : typeof n != "number" || n === 0 || aa.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
  }
  function vn(e, t, n) {
    if (t != null && typeof t != "object")
      throw Error(s(62));
    if (e = e.style, n != null) {
      for (var a in n)
        !n.hasOwnProperty(a) || t != null && t.hasOwnProperty(a) || (a.indexOf("--") === 0 ? e.setProperty(a, "") : a === "float" ? e.cssFloat = "" : e[a] = "", Xe = !0);
      for (var o in t)
        a = t[o], t.hasOwnProperty(o) && n[o] !== a && (pa(e, o, a), Xe = !0);
    } else
      for (var u in t)
        t.hasOwnProperty(u) && pa(e, u, t[u]);
  }
  function va(e) {
    if (e.indexOf("-") === -1) return !1;
    switch (e) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var pi = /* @__PURE__ */ new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["maskType", "mask-type"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]), vi = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function bn(e) {
    return vi.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
  }
  function In() {
  }
  var Ya = null;
  function ka(e) {
    return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
  }
  var bt = null, yn = null;
  function ol(e) {
    var t = Ba(e);
    if (t && (e = t.stateNode)) {
      var n = e[Mn] || null;
      e: switch (e = t.stateNode, t.type) {
        case "input":
          if (Nn(
            e,
            n.value,
            n.defaultValue,
            n.defaultValue,
            n.checked,
            n.defaultChecked,
            n.type,
            n.name
          ), t = n.name, n.type === "radio" && t != null) {
            for (n = e; n.parentNode; ) n = n.parentNode;
            for (n = n.querySelectorAll(
              'input[name="' + qt(
                "" + t
              ) + '"][type="radio"]'
            ), t = 0; t < n.length; t++) {
              var a = n[t];
              if (a !== e && a.form === e.form) {
                var o = a[Mn] || null;
                if (!o) throw Error(s(90));
                Nn(
                  a,
                  o.value,
                  o.defaultValue,
                  o.defaultValue,
                  o.checked,
                  o.defaultChecked,
                  o.type,
                  o.name
                );
              }
            }
            for (t = 0; t < n.length; t++)
              a = n[t], a.form === e.form && Ga(a);
          }
          break e;
        case "textarea":
          la(e, n.value, n.defaultValue);
          break e;
        case "select":
          t = n.value, t != null && Xn(e, !!n.multiple, t, !1);
      }
    }
  }
  var gl = !1;
  function Xa(e, t, n) {
    if (gl) return e(t, n);
    gl = !0;
    try {
      var a = e(t);
      return a;
    } finally {
      if (gl = !1, (bt !== null || yn !== null) && (Ms(), bt && (t = bt, e = yn, yn = bt = null, ol(t), e)))
        for (t = 0; t < e.length; t++) ol(e[t]);
    }
  }
  function he(e, t) {
    var n = e.stateNode;
    if (n === null) return null;
    var a = n[Mn] || null;
    if (a === null) return null;
    n = a[t];
    e: switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (a = !a.disabled) || (e = e.type, a = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !a;
        break e;
      default:
        e = !1;
    }
    if (e) return null;
    if (n && typeof n != "function")
      throw Error(
        s(231, t, typeof n)
      );
    return n;
  }
  var ve = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), We = !1;
  if (ve)
    try {
      var mt = {};
      Object.defineProperty(mt, "passive", {
        get: function() {
          We = !0;
        }
      }), window.addEventListener("test", mt, mt), window.removeEventListener("test", mt, mt);
    } catch {
      We = !1;
    }
  var Mt = null, an = null, Ht = null;
  function on() {
    if (Ht) return Ht;
    var e, t = an, n = t.length, a, o = "value" in Mt ? Mt.value : Mt.textContent, u = o.length;
    for (e = 0; e < n && t[e] === o[e]; e++) ;
    var d = n - e;
    for (a = 1; a <= d && t[n - a] === o[u - a]; a++) ;
    return Ht = o.slice(e, 1 < a ? 1 - a : void 0);
  }
  function Vn(e) {
    var t = e.keyCode;
    return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
  }
  function ba() {
    return !0;
  }
  function Ka() {
    return !1;
  }
  function Ln(e) {
    function t(n, a, o, u, d) {
      this._reactName = n, this._targetInst = o, this.type = a, this.nativeEvent = u, this.target = d, this.currentTarget = null;
      for (var S in e)
        e.hasOwnProperty(S) && (n = e[S], this[S] = n ? n(u) : u[S]);
      return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === !1) ? ba : Ka, this.isPropagationStopped = Ka, this;
    }
    return _(t.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var n = this.nativeEvent;
        n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = ba);
      },
      stopPropagation: function() {
        var n = this.nativeEvent;
        n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = ba);
      },
      persist: function() {
      },
      isPersistent: ba
    }), t;
  }
  var ia = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(e) {
      return e.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, _u = Ln(ia), wr = _({}, ia, { view: 0, detail: 0 }), w1 = Ln(wr), Wc, ef, Mr, ju = _({}, wr, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: nf,
    button: 0,
    buttons: 0,
    relatedTarget: function(e) {
      return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
    },
    movementX: function(e) {
      return "movementX" in e ? e.movementX : (e !== Mr && (Mr && e.type === "mousemove" ? (Wc = e.screenX - Mr.screenX, ef = e.screenY - Mr.screenY) : ef = Wc = 0, Mr = e), Wc);
    },
    movementY: function(e) {
      return "movementY" in e ? e.movementY : ef;
    }
  }), J0 = Ln(ju), M1 = _({}, ju, { dataTransfer: 0 }), N1 = Ln(M1), D1 = _({}, wr, { relatedTarget: 0 }), tf = Ln(D1), z1 = _({}, ia, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), _1 = Ln(z1), j1 = _({}, ia, {
    clipboardData: function(e) {
      return "clipboardData" in e ? e.clipboardData : window.clipboardData;
    }
  }), H1 = Ln(j1), U1 = _({}, ia, { data: 0 }), $0 = Ln(U1), I1 = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, V1 = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, L1 = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function B1(e) {
    var t = this.nativeEvent;
    return t.getModifierState ? t.getModifierState(e) : (e = L1[e]) ? !!t[e] : !1;
  }
  function nf() {
    return B1;
  }
  var q1 = _({}, wr, {
    key: function(e) {
      if (e.key) {
        var t = I1[e.key] || e.key;
        if (t !== "Unidentified") return t;
      }
      return e.type === "keypress" ? (e = Vn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? V1[e.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: nf,
    charCode: function(e) {
      return e.type === "keypress" ? Vn(e) : 0;
    },
    keyCode: function(e) {
      return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
    },
    which: function(e) {
      return e.type === "keypress" ? Vn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
    }
  }), G1 = Ln(q1), Y1 = _({}, ju, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  }), W0 = Ln(Y1), k1 = _({}, ia, { submitter: 0 }), X1 = Ln(k1), K1 = _({}, wr, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: nf
  }), P1 = Ln(K1), Q1 = _({}, ia, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), Z1 = Ln(Q1), F1 = _({}, ju, {
    deltaX: function(e) {
      return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
    },
    deltaY: function(e) {
      return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), J1 = Ln(F1), $1 = _({}, ia, {
    newState: 0,
    oldState: 0,
    source: 0
  }), W1 = Ln($1), ex = [9, 13, 27, 32], lf = ve && "CompositionEvent" in window, Nr = null;
  ve && "documentMode" in document && (Nr = document.documentMode);
  var tx = ve && "TextEvent" in window && !Nr, eg = ve && (!lf || Nr && 8 < Nr && 11 >= Nr), tg = " ", ng = !1;
  function lg(e, t) {
    switch (e) {
      case "keyup":
        return ex.indexOf(t.keyCode) !== -1;
      case "keydown":
        return t.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function ag(e) {
    return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
  }
  var jo = !1;
  function nx(e, t) {
    switch (e) {
      case "compositionend":
        return ag(t);
      case "keypress":
        return t.which !== 32 ? null : (ng = !0, tg);
      case "textInput":
        return e = t.data, e === tg && ng ? null : e;
      default:
        return null;
    }
  }
  function lx(e, t) {
    if (jo)
      return e === "compositionend" || !lf && lg(e, t) ? (e = on(), Ht = an = Mt = null, jo = !1, e) : null;
    switch (e) {
      case "paste":
        return null;
      case "keypress":
        if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
          if (t.char && 1 < t.char.length)
            return t.char;
          if (t.which) return String.fromCharCode(t.which);
        }
        return null;
      case "compositionend":
        return eg && t.locale !== "ko" ? null : t.data;
      default:
        return null;
    }
  }
  var ax = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
  };
  function ig(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t === "input" ? !!ax[e.type] : t === "textarea";
  }
  function og(e, t, n, a) {
    bt ? yn ? yn.push(a) : yn = [a] : bt = a, t = Hs(t, "onChange"), 0 < t.length && (n = new _u(
      "onChange",
      "change",
      null,
      n,
      a
    ), e.push({ event: n, listeners: t }));
  }
  var Dr = null, zr = null;
  function ix(e) {
    Pp(e, 0);
  }
  function Hu(e) {
    var t = W(e);
    if (Ga(t)) return e;
  }
  function rg(e, t) {
    if (e === "change") return t;
  }
  var ug = !1;
  if (ve) {
    var af;
    if (ve) {
      var of = "oninput" in document;
      if (!of) {
        var sg = document.createElement("div");
        sg.setAttribute("oninput", "return;"), of = typeof sg.oninput == "function";
      }
      af = of;
    } else af = !1;
    ug = af && (!document.documentMode || 9 < document.documentMode);
  }
  function cg() {
    Dr && (Dr.detachEvent("onpropertychange", fg), zr = Dr = null);
  }
  function fg(e) {
    if (e.propertyName === "value" && Hu(zr)) {
      var t = [];
      og(
        t,
        zr,
        e,
        ka(e)
      ), Xa(ix, t);
    }
  }
  function ox(e, t, n) {
    e === "focusin" ? (cg(), Dr = t, zr = n, Dr.attachEvent("onpropertychange", fg)) : e === "focusout" && cg();
  }
  function rx(e) {
    if (e === "selectionchange" || e === "keyup" || e === "keydown")
      return Hu(zr);
  }
  function ux(e, t) {
    if (e === "click") return Hu(t);
  }
  function sx(e, t) {
    if (e === "input" || e === "change")
      return Hu(t);
  }
  function cx(e, t) {
    return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
  }
  var Dl = typeof Object.is == "function" ? Object.is : cx;
  function _r(e, t) {
    if (Dl(e, t)) return !0;
    if (typeof e != "object" || e === null || typeof t != "object" || t === null)
      return !1;
    var n = Object.keys(e), a = Object.keys(t);
    if (n.length !== a.length) return !1;
    for (a = 0; a < n.length; a++) {
      var o = n[a];
      if (!Wn.call(t, o) || !Dl(e[o], t[o]))
        return !1;
    }
    return !0;
  }
  function rf(e) {
    if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u") return null;
    try {
      return e.activeElement || e.body;
    } catch {
      return e.body;
    }
  }
  function dg(e) {
    for (; e && e.firstChild; ) e = e.firstChild;
    return e;
  }
  function mg(e, t) {
    var n = dg(e);
    e = 0;
    for (var a; n; ) {
      if (n.nodeType === 3) {
        if (a = e + n.textContent.length, e <= t && a >= t)
          return { node: n, offset: t - e };
        e = a;
      }
      e: {
        for (; n; ) {
          if (n.nextSibling) {
            n = n.nextSibling;
            break e;
          }
          n = n.parentNode;
        }
        n = void 0;
      }
      n = dg(n);
    }
  }
  function gg(e, t) {
    return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? gg(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
  }
  function hg(e) {
    e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
    for (var t = rf(e.document); t instanceof e.HTMLIFrameElement; ) {
      try {
        var n = typeof t.contentWindow.location.href == "string";
      } catch {
        n = !1;
      }
      if (n) e = t.contentWindow;
      else break;
      t = rf(e.document);
    }
    return t;
  }
  function uf(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
  }
  var fx = ve && "documentMode" in document && 11 >= document.documentMode, Ho = null, sf = null, jr = null, cf = !1;
  function pg(e, t, n) {
    var a = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
    cf || Ho == null || Ho !== rf(a) || (a = Ho, "selectionStart" in a && uf(a) ? a = { start: a.selectionStart, end: a.selectionEnd } : (a = (a.ownerDocument && a.ownerDocument.defaultView || window).getSelection(), a = {
      anchorNode: a.anchorNode,
      anchorOffset: a.anchorOffset,
      focusNode: a.focusNode,
      focusOffset: a.focusOffset
    }), jr && _r(jr, a) || (jr = a, a = Hs(sf, "onSelect"), 0 < a.length && (t = new _u(
      "onSelect",
      "select",
      null,
      t,
      n
    ), e.push({ event: t, listeners: a }), t.target = Ho)));
  }
  function Wi(e, t) {
    var n = {};
    return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
  }
  var Uo = {
    animationend: Wi("Animation", "AnimationEnd"),
    animationiteration: Wi("Animation", "AnimationIteration"),
    animationstart: Wi("Animation", "AnimationStart"),
    transitionrun: Wi("Transition", "TransitionRun"),
    transitionstart: Wi("Transition", "TransitionStart"),
    transitioncancel: Wi("Transition", "TransitionCancel"),
    transitionend: Wi("Transition", "TransitionEnd")
  }, ff = {}, vg = {};
  ve && (vg = document.createElement("div").style, "AnimationEvent" in window || (delete Uo.animationend.animation, delete Uo.animationiteration.animation, delete Uo.animationstart.animation), "TransitionEvent" in window || delete Uo.transitionend.transition);
  function eo(e) {
    if (ff[e]) return ff[e];
    if (!Uo[e]) return e;
    var t = Uo[e], n;
    for (n in t)
      if (t.hasOwnProperty(n) && n in vg)
        return ff[e] = t[n];
    return e;
  }
  var bg = eo("animationend"), yg = eo("animationiteration"), xg = eo("animationstart"), dx = eo("transitionrun"), mx = eo("transitionstart"), gx = eo("transitioncancel"), Sg = eo("transitionend"), Eg = /* @__PURE__ */ new Map(), df = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  df.push("scrollEnd");
  function oa(e, t) {
    Eg.set(e, t), Ze(t, [e]);
  }
  var hx = 0;
  function Pa(e, t) {
    if (e.name != null && e.name !== "auto") return e.name;
    if (t.autoName !== null) return t.autoName;
    e = ca.identifierPrefix;
    var n = hx++;
    return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
  }
  function Cg(e) {
    if (e == null || typeof e == "string")
      return e;
    var t = null, n = nr;
    if (n !== null)
      for (var a = 0; a < n.length; a++) {
        var o = e[n[a]];
        if (o != null) {
          if (o === "none") return "none";
          t = t == null ? o : t + (" " + o);
        }
      }
    return t ?? e.default;
  }
  function Qa(e, t) {
    return e = Cg(e), t = Cg(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
  }
  var Uu = typeof reportError == "function" ? reportError : function(e) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var t = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof e == "object" && e !== null && typeof e.message == "string" ? String(e.message) : String(e),
        error: e
      });
      if (!window.dispatchEvent(t)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", e);
      return;
    }
    console.error(e);
  }, kl = [], Io = 0, mf = 0;
  function Iu() {
    for (var e = Io, t = mf = Io = 0; t < e; ) {
      var n = kl[t];
      kl[t++] = null;
      var a = kl[t];
      kl[t++] = null;
      var o = kl[t];
      kl[t++] = null;
      var u = kl[t];
      if (kl[t++] = null, a !== null && o !== null) {
        var d = a.pending;
        d === null ? o.next = o : (o.next = d.next, d.next = o), a.pending = o;
      }
      u !== 0 && Rg(n, o, u);
    }
  }
  function Vu(e, t, n, a) {
    kl[Io++] = e, kl[Io++] = t, kl[Io++] = n, kl[Io++] = a, mf |= a, e.lanes |= a, e = e.alternate, e !== null && (e.lanes |= a);
  }
  function gf(e, t, n, a) {
    return Vu(e, t, n, a), Lu(e);
  }
  function to(e, t) {
    return Vu(e, null, null, t), Lu(e);
  }
  function Rg(e, t, n) {
    e.lanes |= n;
    var a = e.alternate;
    a !== null && (a.lanes |= n);
    for (var o = !1, u = e.return; u !== null; )
      u.childLanes |= n, a = u.alternate, a !== null && (a.childLanes |= n), u.tag === 22 && (e = u.stateNode, e === null || e._visibility & 1 || (o = !0)), e = u, u = u.return;
    return e.tag === 3 ? (u = e.stateNode, o && t !== null && (o = 31 - pt(n), e = u.hiddenUpdates, a = e[o], a === null ? e[o] = [t] : a.push(t), t.lane = n | 536870912), u) : null;
  }
  function Lu(e) {
    if (50 < nu)
      throw nu = 0, ws = null, Error(s(185));
    for (var t = e.return; t !== null; )
      e = t, t = e.return;
    return e.tag === 3 ? e.stateNode : null;
  }
  var Vo = {};
  function px(e, t, n, a) {
    this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function El(e, t, n, a) {
    return new px(e, t, n, a);
  }
  function hf(e) {
    return e = e.prototype, !(!e || !e.isReactComponent);
  }
  function Za(e, t) {
    var n = e.alternate;
    return n === null ? (n = El(
      e.tag,
      t,
      e.key,
      e.mode
    ), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
  }
  function Tg(e, t) {
    e.flags &= 1206910978;
    var n = e.alternate;
    return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
      lanes: t.lanes,
      firstContext: t.firstContext
    }), e;
  }
  function Bu(e, t, n, a, o, u) {
    var d = 0;
    if (a = e, typeof a == "function") hf(a) && (d = 1);
    else if (typeof a == "string")
      d = kS(
        e,
        n,
        Ee.current
      ) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
    else
      e: switch (a) {
        case De:
          return e = El(31, n, t, o), e.elementType = De, e.lanes = u, e;
        case q:
          return no(n.children, o, u, t);
        case $:
          d = 8, o |= 24;
          break;
        case Z:
          return e = El(12, n, t, o | 2), e.elementType = Z, e.lanes = u, e;
        case ie:
          return e = El(13, n, t, o), e.elementType = ie, e.lanes = u, e;
        case P:
          return e = El(19, n, t, o), e.elementType = P, e.lanes = u, e;
        case ge:
        case O:
          return e = o | 32, e = El(30, n, t, e), e.elementType = O, e.lanes = u, e.stateNode = {
            autoName: null,
            paired: null,
            clones: null,
            ref: null
          }, e;
        default:
          if (typeof a == "object" && a !== null)
            switch (a.$$typeof) {
              case le:
                d = 10;
                break e;
              case G:
                d = 9;
                break e;
              case k:
                d = 11;
                break e;
              case J:
                d = 14;
                break e;
              case te:
                d = 16, a = null;
                break e;
            }
          d = 29, n = Error(
            s(130, e === null ? "null" : typeof e, "")
          ), a = null;
      }
    return t = El(d, n, t, o), t.elementType = e, t.type = a, t.lanes = u, t;
  }
  function no(e, t, n, a) {
    return e = El(7, e, a, t), e.lanes = n, e;
  }
  function pf(e, t, n) {
    return e = El(6, e, null, t), e.lanes = n, e;
  }
  function Ag(e) {
    var t = El(18, null, null, 0);
    return t.stateNode = e, t;
  }
  function vf(e, t, n) {
    return t = El(
      4,
      e.children !== null ? e.children : [],
      e.key,
      t
    ), t.lanes = n, t.stateNode = {
      containerInfo: e.containerInfo,
      pendingChildren: null,
      implementation: e.implementation
    }, t;
  }
  var Og = /* @__PURE__ */ new WeakMap();
  function Xl(e, t) {
    if (typeof e == "object" && e !== null) {
      var n = Og.get(e);
      return n !== void 0 ? n : (t = {
        value: e,
        source: t,
        stack: ft(t)
      }, Og.set(e, t), t);
    }
    return {
      value: e,
      source: t,
      stack: ft(t)
    };
  }
  var Lo = [], Bo = 0, qu = null, Hr = 0, Kl = [], Pl = 0, bi = null, ya = 1, xa = "";
  function Fa(e, t) {
    Lo[Bo++] = Hr, Lo[Bo++] = qu, qu = e, Hr = t;
  }
  function wg(e, t, n) {
    Kl[Pl++] = ya, Kl[Pl++] = xa, Kl[Pl++] = bi, bi = e;
    var a = ya;
    e = xa;
    var o = 32 - pt(a) - 1;
    a &= ~(1 << o), n += 1;
    var u = 32 - pt(t) + o;
    if (30 < u) {
      var d = o - o % 5;
      u = (a & (1 << d) - 1).toString(32), a >>= d, o -= d, ya = 1 << 32 - pt(t) + o | n << o | a, xa = u + e;
    } else
      ya = 1 << u | n << o | a, xa = e;
  }
  function Gu(e) {
    e.return !== null && (Fa(e, 1), wg(e, 1, 0));
  }
  function bf(e) {
    for (; e === qu; )
      qu = Lo[--Bo], Lo[Bo] = null, Hr = Lo[--Bo], Lo[Bo] = null;
    for (; e === bi; )
      bi = Kl[--Pl], Kl[Pl] = null, xa = Kl[--Pl], Kl[Pl] = null, ya = Kl[--Pl], Kl[Pl] = null;
  }
  function Mg(e, t) {
    Kl[Pl++] = ya, Kl[Pl++] = xa, Kl[Pl++] = bi, ya = t.id, xa = t.overflow, bi = e;
  }
  var Bn = null, Kt = null, st = !1, yi = null, Ql = !1, yf = Error(s(519));
  function xi(e) {
    var t = Error(
      s(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw Ur(Xl(t, e)), yf;
  }
  function Ng(e) {
    var t = e.stateNode, n = e.type, a = e.memoizedProps;
    switch (t[Xt] = e, t[Mn] = a, n) {
      case "dialog":
        ht("cancel", t), ht("close", t);
        break;
      case "iframe":
      case "object":
      case "embed":
        ht("load", t);
        break;
      case "video":
      case "audio":
        for (n = 0; n < au.length; n++)
          ht(au[n], t);
        break;
      case "source":
        ht("error", t);
        break;
      case "img":
      case "image":
      case "link":
        ht("error", t), ht("load", t);
        break;
      case "details":
        ht("toggle", t);
        break;
      case "input":
        ht("invalid", t), ha(
          t,
          a.value,
          a.defaultValue,
          a.checked,
          a.defaultChecked,
          a.type,
          a.name,
          !0
        );
        break;
      case "select":
        ht("invalid", t);
        break;
      case "textarea":
        ht("invalid", t), il(t, a.value, a.defaultValue, a.children);
    }
    n = a.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || a.suppressHydrationWarning === !0 || Jp(t.textContent, n) ? (a.popover != null && (ht("beforetoggle", t), ht("toggle", t)), a.onScroll != null && ht("scroll", t), a.onScrollEnd != null && ht("scrollend", t), a.onClick != null && (t.onclick = In), t = !0) : t = !1, t || xi(e, !0);
  }
  function Yu(e) {
    for (Bn = e.return; Bn; )
      switch (Bn.tag) {
        case 5:
        case 31:
        case 13:
          Ql = !1;
          return;
        case 27:
        case 3:
          Ql = !0;
          return;
        default:
          Bn = Bn.return;
      }
  }
  function qo(e) {
    if (e !== Bn) return !1;
    if (!st) return Yu(e), st = !0, !1;
    var t = e.tag, n;
    if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = !(n !== "form" && n !== "button") || Zd(e.type, e.memoizedProps)), n = !n), n && Kt && xi(e), Yu(e), t === 13) {
      if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
      Kt = pv(e);
    } else if (t === 31) {
      if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
      Kt = pv(e);
    } else
      t === 27 ? (t = Kt, Ui(e.type) ? (e = am, am = null, Kt = e) : Kt = t) : Kt = Bn ? Fl(e.stateNode.nextSibling) : null;
    return !0;
  }
  function lo() {
    Kt = Bn = null, st = !1;
  }
  function xf() {
    var e = yi;
    return e !== null && (Tl === null ? Tl = e : Tl.push.apply(
      Tl,
      e
    ), yi = null), e;
  }
  function Ur(e) {
    yi === null ? yi = [e] : yi.push(e);
  }
  var Sf = Se(null), ao = null, Ja = null;
  function Si(e, t, n) {
    Ne(Sf, t._currentValue), t._currentValue = n;
  }
  function $a(e) {
    e._currentValue = Sf.current, be(Sf);
  }
  function ku(e, t, n) {
    for (; e !== null; ) {
      var a = e.alternate;
      if ((e.childLanes & t) !== t ? (e.childLanes |= t, a !== null && (a.childLanes |= t)) : a !== null && (a.childLanes & t) !== t && (a.childLanes |= t), e === n) break;
      e = e.return;
    }
  }
  function Ef(e, t, n, a) {
    var o = e.child;
    for (o !== null && (o.return = e); o !== null; ) {
      var u = o.dependencies;
      if (u !== null) {
        var d = o.child;
        u = u.firstContext;
        e: for (; u !== null; ) {
          var S = u;
          u = o;
          for (var D = 0; D < t.length; D++)
            if (S.context === t[D]) {
              u.lanes |= n, S = u.alternate, S !== null && (S.lanes |= n), ku(
                u.return,
                n,
                e
              ), a || (d = null);
              break e;
            }
          u = S.next;
        }
      } else if (o.tag === 18) {
        if (d = o.return, d === null) throw Error(s(341));
        d.lanes |= n, u = d.alternate, u !== null && (u.lanes |= n), ku(d, n, e), d = null;
      } else
        o.tag === 13 && o.memoizedState !== null && o.memoizedState.dehydrated === null ? (o.lanes |= n, d = o.alternate, d !== null && (d.lanes |= n), ku(
          o.return,
          n,
          e
        ), d = o.child, d = d !== null ? d.sibling : null) : d = o.child;
      if (d !== null) d.return = o;
      else
        for (d = o; d !== null; ) {
          if (d === e) {
            d = null;
            break;
          }
          if (o = d.sibling, o !== null) {
            o.return = d.return, d = o;
            break;
          }
          d = d.return;
        }
      o = d;
    }
  }
  function io(e, t, n, a) {
    e = null;
    for (var o = t, u = !1; o !== null; ) {
      if (!u) {
        if ((o.flags & 524288) !== 0) u = !0;
        else if ((o.flags & 262144) !== 0) break;
      }
      if (o.tag === 10) {
        var d = o.alternate;
        if (d === null) throw Error(s(387));
        if (d = d.memoizedProps, d !== null) {
          var S = o.type;
          Dl(o.pendingProps.value, d.value) || (e !== null ? e.push(S) : e = [S]);
        }
      } else if (o === Me.current) {
        if (d = o.alternate, d === null) throw Error(s(387));
        d.memoizedState.memoizedState !== o.memoizedState.memoizedState && (e !== null ? e.push(dr) : e = [dr]);
      }
      o = o.return;
    }
    return e !== null && Ef(
      t,
      e,
      n,
      a
    ), t.flags |= 262144, e !== null;
  }
  function Xu(e) {
    for (e = e.firstContext; e !== null; ) {
      if (!Dl(
        e.context._currentValue,
        e.memoizedValue
      ))
        return !0;
      e = e.next;
    }
    return !1;
  }
  function oo(e) {
    ao = e, Ja = null, e = e.dependencies, e !== null && (e.firstContext = null);
  }
  function Kn(e) {
    return Dg(ao, e);
  }
  function Ku(e, t) {
    return ao === null && oo(e), Dg(e, t);
  }
  function Dg(e, t) {
    var n = t._currentValue;
    if (t = { context: t, memoizedValue: n, next: null }, Ja === null) {
      if (e === null) throw Error(s(308));
      Ja = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
    } else Ja = Ja.next = t;
    return n;
  }
  var vx = typeof AbortController < "u" ? AbortController : function() {
    var e = [], t = this.signal = {
      aborted: !1,
      addEventListener: function(n, a) {
        e.push(a);
      }
    };
    this.abort = function() {
      t.aborted = !0, e.forEach(function(n) {
        return n();
      });
    };
  }, bx = l.unstable_scheduleCallback, yx = l.unstable_NormalPriority, xn = {
    $$typeof: le,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function Cf() {
    return {
      controller: new vx(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function Ir(e) {
    e.refCount--, e.refCount === 0 && bx(yx, function() {
      e.controller.abort();
    });
  }
  function zg(e, t) {
    if ((e.pendingLanes & 4194048) !== 0) {
      var n = e.transitionTypes;
      for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
        var a = t[e];
        n.indexOf(a) === -1 && n.push(a);
      }
    }
  }
  var Vr = null;
  function xx(e) {
    var t = e.transitionTypes;
    return e.transitionTypes = null, t;
  }
  var Lr = null, Rf = 0, ro = 0, Go = null;
  function Sx(e, t) {
    if (Lr === null) {
      var n = Lr = [];
      Rf = 0, ro = Bd(), Go = {
        status: "pending",
        value: void 0,
        then: function(a) {
          n.push(a);
        }
      };
    }
    return Rf++, t.then(_g, _g), t;
  }
  function _g() {
    if (--Rf === 0 && (Vr = null, Lr !== null)) {
      Go !== null && (Go.status = "fulfilled");
      var e = Lr;
      Lr = null, ro = 0, Go = null;
      for (var t = 0; t < e.length; t++) (0, e[t])();
    }
  }
  function Ex(e, t) {
    var n = [], a = {
      status: "pending",
      value: null,
      reason: null,
      then: function(o) {
        n.push(o);
      }
    };
    return e.then(
      function() {
        a.status = "fulfilled", a.value = t;
        for (var o = 0; o < n.length; o++) (0, n[o])(t);
      },
      function(o) {
        for (a.status = "rejected", a.reason = o, o = 0; o < n.length; o++)
          (0, n[o])(void 0);
      }
    ), a;
  }
  var jg = pe.S;
  pe.S = function(e, t) {
    if (Ap = Zt(), typeof t == "object" && t !== null && typeof t.then == "function" && Sx(e, t), Vr !== null)
      for (var n = or; n !== null; )
        zg(n, Vr), n = n.next;
    if (n = e.types, n !== null) {
      for (var a = or; a !== null; )
        zg(a, n), a = a.next;
      if (ro !== 0) {
        a = Vr, a === null && (a = Vr = []);
        for (var o = 0; o < n.length; o++) {
          var u = n[o];
          a.indexOf(u) === -1 && a.push(u);
        }
      }
    }
    jg !== null && jg(e, t);
  };
  var uo = Se(null);
  function Tf() {
    var e = uo.current;
    return e !== null ? e : Gt.pooledCache;
  }
  function Pu(e, t) {
    t === null ? Ne(uo, uo.current) : Ne(uo, t.pool);
  }
  function Hg() {
    var e = Tf();
    return e === null ? null : { parent: xn._currentValue, pool: e };
  }
  var Yo = Error(s(460)), Af = Error(s(474)), Qu = Error(s(542)), Zu = { then: function() {
  } };
  function Ug(e) {
    return e = e.status, e === "fulfilled" || e === "rejected";
  }
  function Ig(e, t, n) {
    switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(In, In), t = n), t.status) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw e = t.reason, Lg(e), e === void 0 && !("reason" in t) ? Error(s(600)) : e;
      default:
        if (typeof t.status == "string") t.then(In, In);
        else {
          if (e = Gt, e !== null && 100 < e.shellSuspendCounter)
            throw Error(s(482));
          e = t, e.status = "pending", e.then(
            function(a) {
              if (t.status === "pending") {
                var o = t;
                o.status = "fulfilled", o.value = a;
              }
            },
            function(a) {
              if (t.status === "pending") {
                var o = t;
                o.status = "rejected", o.reason = a;
              }
            }
          );
        }
        switch (t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, Lg(e), e;
        }
        throw co = t, Yo;
    }
  }
  function so(e) {
    try {
      var t = e._init;
      return t(e._payload);
    } catch (n) {
      throw n !== null && typeof n == "object" && typeof n.then == "function" ? (co = n, Yo) : n;
    }
  }
  var co = null;
  function Vg() {
    if (co === null) throw Error(s(459));
    var e = co;
    return co = null, e;
  }
  function Lg(e) {
    if (e === Yo || e === Qu)
      throw Error(s(483));
  }
  var ko = null, Br = 0;
  function Fu(e) {
    var t = Br;
    return Br += 1, ko === null && (ko = []), Ig(ko, e, t);
  }
  function Ei(e, t) {
    t = t.props.ref, e.ref = t !== void 0 ? t : null;
  }
  function Ju(e, t) {
    throw t.$$typeof === U ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(
      s(
        31,
        e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
      )
    ));
  }
  function Bg(e) {
    function t(X, L) {
      if (e) {
        var Q = X.deletions;
        Q === null ? (X.deletions = [L], X.flags |= 16) : Q.push(L);
      }
    }
    function n(X, L) {
      if (!e) return null;
      for (; L !== null; )
        t(X, L), L = L.sibling;
      return null;
    }
    function a(X) {
      for (var L = /* @__PURE__ */ new Map(); X !== null; )
        X.key === null ? L.set(X.index, X) : L.set(X.key, X), X = X.sibling;
      return L;
    }
    function o(X, L) {
      return X = Za(X, L), X.index = 0, X.sibling = null, X;
    }
    function u(X, L, Q) {
      return X.index = Q, e ? (Q = X.alternate, Q !== null ? (Q = Q.index, Q < L ? (X.flags |= 2, L) : Q) : (X.flags |= 134217730, L)) : (X.flags |= 1048576, L);
    }
    function d(X) {
      return e && X.alternate === null && (X.flags |= 134217730), X;
    }
    function S(X, L, Q, ue) {
      return L === null || L.tag !== 6 ? (L = pf(Q, X.mode, ue), L.return = X, L) : (L = o(L, Q), L.return = X, L);
    }
    function D(X, L, Q, ue) {
      var _e = Q.type;
      return _e === q ? (X = ee(
        X,
        L,
        Q.props.children,
        ue,
        Q.key
      ), Ei(X, Q), X) : L !== null && (L.elementType === _e || typeof _e == "object" && _e !== null && _e.$$typeof === te && so(_e) === L.type) ? (L = o(L, Q.props), Ei(L, Q), L.return = X, L) : (L = Bu(
        Q.type,
        Q.key,
        Q.props,
        null,
        X.mode,
        ue
      ), Ei(L, Q), L.return = X, L);
    }
    function K(X, L, Q, ue) {
      return L === null || L.tag !== 4 || L.stateNode.containerInfo !== Q.containerInfo || L.stateNode.implementation !== Q.implementation ? (L = vf(Q, X.mode, ue), L.return = X, L) : (L = o(L, Q.children || []), L.return = X, L);
    }
    function ee(X, L, Q, ue, _e) {
      return L === null || L.tag !== 7 ? (L = no(
        Q,
        X.mode,
        ue,
        _e
      ), L.return = X, L) : (L = o(L, Q), L.return = X, L);
    }
    function se(X, L, Q) {
      if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint")
        return L = pf(
          "" + L,
          X.mode,
          Q
        ), L.return = X, L;
      if (typeof L == "object" && L !== null) {
        switch (L.$$typeof) {
          case j:
            return Q = Bu(
              L.type,
              L.key,
              L.props,
              null,
              X.mode,
              Q
            ), Ei(Q, L), Q.return = X, Q;
          case H:
            return L = vf(
              L,
              X.mode,
              Q
            ), L.return = X, L;
          case te:
            return L = so(L), se(X, L, Q);
        }
        if (Ae(L) || oe(L))
          return L = no(
            L,
            X.mode,
            Q,
            null
          ), L.return = X, L;
        if (typeof L.then == "function")
          return se(X, Fu(L), Q);
        if (L.$$typeof === le)
          return se(
            X,
            Ku(X, L),
            Q
          );
        Ju(X, L);
      }
      return null;
    }
    function Y(X, L, Q, ue) {
      var _e = L !== null ? L.key : null;
      if (typeof Q == "string" && Q !== "" || typeof Q == "number" || typeof Q == "bigint")
        return _e !== null ? null : S(X, L, "" + Q, ue);
      if (typeof Q == "object" && Q !== null) {
        switch (Q.$$typeof) {
          case j:
            return Q.key === _e ? D(X, L, Q, ue) : null;
          case H:
            return Q.key === _e ? K(X, L, Q, ue) : null;
          case te:
            return Q = so(Q), Y(X, L, Q, ue);
        }
        if (Ae(Q) || oe(Q))
          return _e !== null ? null : ee(X, L, Q, ue, null);
        if (typeof Q.then == "function")
          return Y(
            X,
            L,
            Fu(Q),
            ue
          );
        if (Q.$$typeof === le)
          return Y(
            X,
            L,
            Ku(X, Q),
            ue
          );
        Ju(X, Q);
      }
      return null;
    }
    function F(X, L, Q, ue, _e) {
      if (typeof ue == "string" && ue !== "" || typeof ue == "number" || typeof ue == "bigint")
        return X = X.get(Q) || null, S(L, X, "" + ue, _e);
      if (typeof ue == "object" && ue !== null) {
        switch (ue.$$typeof) {
          case j:
            return X = X.get(
              ue.key === null ? Q : ue.key
            ) || null, D(L, X, ue, _e);
          case H:
            return X = X.get(
              ue.key === null ? Q : ue.key
            ) || null, K(L, X, ue, _e);
          case te:
            return ue = so(ue), F(
              X,
              L,
              Q,
              ue,
              _e
            );
        }
        if (Ae(ue) || oe(ue))
          return X = X.get(Q) || null, ee(L, X, ue, _e, null);
        if (typeof ue.then == "function")
          return F(
            X,
            L,
            Q,
            Fu(ue),
            _e
          );
        if (ue.$$typeof === le)
          return F(
            X,
            L,
            Q,
            Ku(L, ue),
            _e
          );
        Ju(L, ue);
      }
      return null;
    }
    function we(X, L, Q, ue) {
      for (var _e = null, xt = null, Ge = L, Je = L = 0, Cn = null; Ge !== null && Je < Q.length; Je++) {
        Ge.index > Je ? (Cn = Ge, Ge = null) : Cn = Ge.sibling;
        var Et = Y(
          X,
          Ge,
          Q[Je],
          ue
        );
        if (Et === null) {
          Ge === null && (Ge = Cn);
          break;
        }
        e && Ge && Et.alternate === null && t(X, Ge), L = u(Et, L, Je), xt === null ? _e = Et : xt.sibling = Et, xt = Et, Ge = Cn;
      }
      if (Je === Q.length)
        return n(X, Ge), st && Fa(X, Je), _e;
      if (Ge === null) {
        for (; Je < Q.length; Je++)
          Ge = se(X, Q[Je], ue), Ge !== null && (L = u(
            Ge,
            L,
            Je
          ), xt === null ? _e = Ge : xt.sibling = Ge, xt = Ge);
        return st && Fa(X, Je), _e;
      }
      for (Ge = a(Ge); Je < Q.length; Je++)
        Cn = F(
          Ge,
          X,
          Je,
          Q[Je],
          ue
        ), Cn !== null && (e && (Et = Cn.alternate, Et !== null && Ge.delete(Et.key === null ? Je : Et.key)), L = u(
          Cn,
          L,
          Je
        ), xt === null ? _e = Cn : xt.sibling = Cn, xt = Cn);
      return e && Ge.forEach(function(qi) {
        return t(X, qi);
      }), st && Fa(X, Je), _e;
    }
    function Ve(X, L, Q, ue) {
      if (Q == null) throw Error(s(151));
      for (var _e = null, xt = null, Ge = L, Je = L = 0, Cn = null, Et = Q.next(); Ge !== null && !Et.done; Je++, Et = Q.next()) {
        Ge.index > Je ? (Cn = Ge, Ge = null) : Cn = Ge.sibling;
        var qi = Y(X, Ge, Et.value, ue);
        if (qi === null) {
          Ge === null && (Ge = Cn);
          break;
        }
        e && Ge && qi.alternate === null && t(X, Ge), L = u(qi, L, Je), xt === null ? _e = qi : xt.sibling = qi, xt = qi, Ge = Cn;
      }
      if (Et.done)
        return n(X, Ge), st && Fa(X, Je), _e;
      if (Ge === null) {
        for (; !Et.done; Je++, Et = Q.next())
          Et = se(X, Et.value, ue), Et !== null && (L = u(Et, L, Je), xt === null ? _e = Et : xt.sibling = Et, xt = Et);
        return st && Fa(X, Je), _e;
      }
      for (Ge = a(Ge); !Et.done; Je++, Et = Q.next())
        Et = F(Ge, X, Je, Et.value, ue), Et !== null && (e && (Cn = Et.alternate, Cn !== null && Ge.delete(
          Cn.key === null ? Je : Cn.key
        )), L = u(Et, L, Je), xt === null ? _e = Et : xt.sibling = Et, xt = Et);
      return e && Ge.forEach(function(nE) {
        return t(X, nE);
      }), st && Fa(X, Je), _e;
    }
    function rt(X, L, Q, ue) {
      if (typeof Q == "object" && Q !== null && Q.type === q && Q.key === null && Q.props.ref === void 0 && (Q = Q.props.children), typeof Q == "object" && Q !== null) {
        switch (Q.$$typeof) {
          case j:
            e: {
              for (var _e = Q.key; L !== null; ) {
                if (L.key === _e) {
                  if (_e = Q.type, _e === q) {
                    if (L.tag === 7) {
                      n(
                        X,
                        L.sibling
                      ), ue = o(
                        L,
                        Q.props.children
                      ), Ei(ue, Q), ue.return = X, X = ue;
                      break e;
                    }
                  } else if (L.elementType === _e || typeof _e == "object" && _e !== null && _e.$$typeof === te && so(_e) === L.type) {
                    n(
                      X,
                      L.sibling
                    ), ue = o(L, Q.props), Ei(ue, Q), ue.return = X, X = ue;
                    break e;
                  }
                  n(X, L);
                  break;
                } else t(X, L);
                L = L.sibling;
              }
              Q.type === q ? (ue = no(
                Q.props.children,
                X.mode,
                ue,
                Q.key
              ), Ei(ue, Q), ue.return = X, X = ue) : (ue = Bu(
                Q.type,
                Q.key,
                Q.props,
                null,
                X.mode,
                ue
              ), Ei(ue, Q), ue.return = X, X = ue);
            }
            return d(X);
          case H:
            e: {
              for (_e = Q.key; L !== null; ) {
                if (L.key === _e)
                  if (L.tag === 4 && L.stateNode.containerInfo === Q.containerInfo && L.stateNode.implementation === Q.implementation) {
                    n(
                      X,
                      L.sibling
                    ), ue = o(L, Q.children || []), ue.return = X, X = ue;
                    break e;
                  } else {
                    n(X, L);
                    break;
                  }
                else t(X, L);
                L = L.sibling;
              }
              ue = vf(Q, X.mode, ue), ue.return = X, X = ue;
            }
            return d(X);
          case te:
            return Q = so(Q), rt(
              X,
              L,
              Q,
              ue
            );
        }
        if (Ae(Q))
          return we(
            X,
            L,
            Q,
            ue
          );
        if (oe(Q)) {
          if (_e = oe(Q), typeof _e != "function") throw Error(s(150));
          return Q = _e.call(Q), Ve(
            X,
            L,
            Q,
            ue
          );
        }
        if (typeof Q.then == "function")
          return rt(
            X,
            L,
            Fu(Q),
            ue
          );
        if (Q.$$typeof === le)
          return rt(
            X,
            L,
            Ku(X, Q),
            ue
          );
        Ju(X, Q);
      }
      return typeof Q == "string" && Q !== "" || typeof Q == "number" || typeof Q == "bigint" ? (Q = "" + Q, L !== null && L.tag === 6 ? (n(X, L.sibling), ue = o(L, Q), ue.return = X, X = ue) : (n(X, L), ue = pf(Q, X.mode, ue), ue.return = X, X = ue), d(X)) : n(X, L);
    }
    return function(X, L, Q, ue) {
      try {
        Br = 0;
        var _e = rt(
          X,
          L,
          Q,
          ue
        );
        return ko = null, _e;
      } catch (Ge) {
        if (Ge === Yo || Ge === Qu) throw Ge;
        var xt = El(29, Ge, null, X.mode);
        return xt.lanes = ue, xt.return = X, xt;
      }
    };
  }
  var fo = Bg(!0), qg = Bg(!1), Ci = !1;
  function Of(e) {
    e.updateQueue = {
      baseState: e.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function wf(e, t) {
    e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
      baseState: e.baseState,
      firstBaseUpdate: e.firstBaseUpdate,
      lastBaseUpdate: e.lastBaseUpdate,
      shared: e.shared,
      callbacks: null
    });
  }
  function Ri(e) {
    return { lane: e, tag: 0, payload: null, callback: null, next: null };
  }
  function Ti(e, t, n) {
    var a = e.updateQueue;
    if (a === null) return null;
    if (a = a.shared, (Dt & 2) !== 0) {
      var o = a.pending;
      return o === null ? t.next = t : (t.next = o.next, o.next = t), a.pending = t, t = Lu(e), Rg(e, null, n), t;
    }
    return Vu(e, a, t, n), Lu(e);
  }
  function qr(e, t, n) {
    if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194048) !== 0)) {
      var a = t.lanes;
      a &= e.pendingLanes, n |= a, t.lanes = n, Gl(e, n);
    }
  }
  function Mf(e, t) {
    var n = e.updateQueue, a = e.alternate;
    if (a !== null && (a = a.updateQueue, n === a)) {
      var o = null, u = null;
      if (n = n.firstBaseUpdate, n !== null) {
        do {
          var d = {
            lane: n.lane,
            tag: n.tag,
            payload: n.payload,
            callback: null,
            next: null
          };
          u === null ? o = u = d : u = u.next = d, n = n.next;
        } while (n !== null);
        u === null ? o = u = t : u = u.next = t;
      } else o = u = t;
      n = {
        baseState: a.baseState,
        firstBaseUpdate: o,
        lastBaseUpdate: u,
        shared: a.shared,
        callbacks: a.callbacks
      }, e.updateQueue = n;
      return;
    }
    e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
  }
  var Nf = !1;
  function Gr() {
    if (Nf) {
      var e = Go;
      if (e !== null) throw e;
    }
  }
  function Yr(e, t, n, a) {
    Nf = !1;
    var o = e.updateQueue;
    Ci = !1;
    var u = o.firstBaseUpdate, d = o.lastBaseUpdate, S = o.shared.pending;
    if (S !== null) {
      o.shared.pending = null;
      var D = S, K = D.next;
      D.next = null, d === null ? u = K : d.next = K, d = D;
      var ee = e.alternate;
      ee !== null && (ee = ee.updateQueue, S = ee.lastBaseUpdate, S !== d && (S === null ? ee.firstBaseUpdate = K : S.next = K, ee.lastBaseUpdate = D));
    }
    if (u !== null) {
      var se = o.baseState;
      d = 0, ee = K = D = null, S = u;
      do {
        var Y = S.lane & -536870913, F = Y !== S.lane;
        if (F ? (yt & Y) === Y : (a & Y) === Y) {
          Y !== 0 && Y === ro && (Nf = !0), ee !== null && (ee = ee.next = {
            lane: 0,
            tag: S.tag,
            payload: S.payload,
            callback: null,
            next: null
          });
          e: {
            var we = e, Ve = S;
            Y = t;
            var rt = n;
            switch (Ve.tag) {
              case 1:
                if (we = Ve.payload, typeof we == "function") {
                  se = we.call(rt, se, Y);
                  break e;
                }
                se = we;
                break e;
              case 3:
                we.flags = we.flags & -65537 | 128;
              case 0:
                if (we = Ve.payload, Y = typeof we == "function" ? we.call(rt, se, Y) : we, Y == null) break e;
                se = _({}, se, Y);
                break e;
              case 2:
                Ci = !0;
            }
          }
          Y = S.callback, Y !== null && (e.flags |= 64, F && (e.flags |= 8192), F = o.callbacks, F === null ? o.callbacks = [Y] : F.push(Y));
        } else
          F = {
            lane: Y,
            tag: S.tag,
            payload: S.payload,
            callback: S.callback,
            next: null
          }, ee === null ? (K = ee = F, D = se) : ee = ee.next = F, d |= Y;
        if (S = S.next, S === null) {
          if (S = o.shared.pending, S === null)
            break;
          F = S, S = F.next, F.next = null, o.lastBaseUpdate = F, o.shared.pending = null;
        }
      } while (!0);
      ee === null && (D = se), o.baseState = D, o.firstBaseUpdate = K, o.lastBaseUpdate = ee, u === null && (o.shared.lanes = 0), zi |= d, e.lanes = d, e.memoizedState = se;
    }
  }
  function Gg(e, t) {
    if (typeof e != "function")
      throw Error(s(191, e));
    e.call(t);
  }
  function Yg(e, t) {
    var n = e.callbacks;
    if (n !== null)
      for (e.callbacks = null, e = 0; e < n.length; e++)
        Gg(n[e], t);
  }
  var Ai = Se(null), $u = Se(0);
  function kg(e, t) {
    e = li, Ne($u, e), Ne(Ai, t), li = e | t.baseLanes;
  }
  function Df() {
    Ne($u, li), Ne(Ai, Ai.current);
  }
  function zf() {
    li = $u.current, be(Ai), be($u);
  }
  var Pn = Se(null), rl = null;
  function Oi(e) {
    var t = e.alternate;
    Ne(Qn, Qn.current & 1), Ne(Pn, e), rl === null && (t === null || Ai.current !== null || t.memoizedState !== null) && (rl = e);
  }
  function _f(e) {
    Ne(Qn, Qn.current), Ne(Pn, e), rl === null && (rl = e);
  }
  function Xg(e) {
    e.tag === 22 ? (Ne(Qn, Qn.current), Ne(Pn, e), rl === null && (rl = e)) : wi();
  }
  function wi() {
    Ne(Qn, Qn.current), Ne(Pn, Pn.current);
  }
  function zl(e) {
    be(Pn), rl === e && (rl = null), be(Qn);
  }
  var Qn = Se(0);
  function kr(e, t) {
    Ne(Pn, Pn.current), Ne(Qn, t);
  }
  function jf(e) {
    be(Qn), be(Pn), rl === e && (rl = null);
  }
  function Wu(e) {
    for (var t = e; t !== null; ) {
      if (t.tag === 13) {
        var n = t.memoizedState;
        if (n !== null && (n = n.dehydrated, n === null || nm(n) || lm(n)))
          return t;
      } else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
        if ((t.flags & 128) !== 0) return t;
      } else if (t.child !== null) {
        t.child.return = t, t = t.child;
        continue;
      }
      if (t === e) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) return null;
        t = t.return;
      }
      t.sibling.return = t.return, t = t.sibling;
    }
    return null;
  }
  var Wa = 0, ot = null, Lt = null, Sn = null, es = !1, Xo = !1, mo = !1, ts = 0, Xr = 0, Ko = null, Cx = 0;
  function fn() {
    throw Error(s(321));
  }
  function Hf(e, t) {
    if (t === null) return !1;
    for (var n = 0; n < t.length && n < e.length; n++)
      if (!Dl(e[n], t[n])) return !1;
    return !0;
  }
  function Uf(e, t, n, a, o, u) {
    return Wa = u, ot = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, pe.H = e === null || e.memoizedState === null ? wh : Mh, mo = !1, u = n(a, o), mo = !1, Xo && (u = Pg(
      t,
      n,
      a,
      o
    )), Kg(e), u;
  }
  function Kg(e) {
    pe.H = us;
    var t = Lt !== null && Lt.next !== null;
    if (Wa = 0, Sn = Lt = ot = null, es = !1, Xr = 0, Ko = null, t) throw Error(s(300));
    e === null || En || (e = e.dependencies, e !== null && Xu(e) && (En = !0));
  }
  function Pg(e, t, n, a) {
    ot = e;
    var o = 0;
    do {
      if (Xo && (Ko = null), Xr = 0, Xo = !1, 25 <= o) throw Error(s(301));
      if (o += 1, Sn = Lt = null, e.updateQueue != null) {
        var u = e.updateQueue;
        u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
      }
      pe.H = Dx, u = t(n, a);
    } while (Xo);
    return u;
  }
  function Rx() {
    var e = pe.H, t = e.useState()[0];
    return t = typeof t.then == "function" ? Kr(t) : t, e = e.useState()[0], (Lt !== null ? Lt.memoizedState : null) !== e && (ot.flags |= 1024), t;
  }
  function If() {
    var e = ts !== 0;
    return ts = 0, e;
  }
  function Vf(e, t, n) {
    t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
  }
  function Lf(e) {
    if (es) {
      for (e = e.memoizedState; e !== null; ) {
        var t = e.queue;
        t !== null && (t.pending = null), e = e.next;
      }
      es = !1;
    }
    Wa = 0, Sn = Lt = ot = null, Xo = !1, Xr = ts = 0, Ko = null;
  }
  function hl() {
    var e = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return Sn === null ? ot.memoizedState = Sn = e : Sn = Sn.next = e, Sn;
  }
  function hn() {
    if (Lt === null) {
      var e = ot.alternate;
      e = e !== null ? e.memoizedState : null;
    } else e = Lt.next;
    var t = Sn === null ? ot.memoizedState : Sn.next;
    if (t !== null)
      Sn = t, Lt = e;
    else {
      if (e === null)
        throw ot.alternate === null ? Error(s(467)) : Error(s(310));
      Lt = e, e = {
        memoizedState: Lt.memoizedState,
        baseState: Lt.baseState,
        baseQueue: Lt.baseQueue,
        queue: Lt.queue,
        next: null
      }, Sn === null ? ot.memoizedState = Sn = e : Sn = Sn.next = e;
    }
    return Sn;
  }
  function ns() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function Kr(e) {
    var t = Xr;
    return Xr += 1, Ko === null && (Ko = []), e = Ig(Ko, e, t), t = ot, (Sn === null ? t.memoizedState : Sn.next) === null && (t = t.alternate, pe.H = t === null || t.memoizedState === null ? wh : Mh), e;
  }
  function ls(e) {
    if (e !== null && typeof e == "object") {
      if (typeof e.then == "function") return Kr(e);
      if (e.$$typeof === B) return;
      if (e.$$typeof === le) return Kn(e);
    }
    throw Error(s(438, String(e)));
  }
  function Bf(e) {
    var t = null, n = ot.updateQueue;
    if (n !== null && (t = n.memoCache), t == null) {
      var a = ot.alternate;
      a !== null && (a = a.updateQueue, a !== null && (a = a.memoCache, a != null && (t = {
        data: a.data.map(function(o) {
          return o.slice();
        }),
        index: 0
      })));
    }
    if (t == null && (t = { data: [], index: 0 }), n === null && (n = ns(), ot.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0)
      for (n = t.data[t.index] = Array(e), a = 0; a < e; a++)
        n[a] = ze;
    return t.index++, n;
  }
  function ei(e, t) {
    return typeof t == "function" ? t(e) : t;
  }
  function as(e) {
    var t = hn();
    return qf(t, Lt, e);
  }
  function qf(e, t, n) {
    var a = e.queue;
    if (a === null) throw Error(s(311));
    a.lastRenderedReducer = n;
    var o = e.baseQueue, u = a.pending;
    if (u !== null) {
      if (o !== null) {
        var d = o.next;
        o.next = u.next, u.next = d;
      }
      t.baseQueue = o = u, a.pending = null;
    }
    if (u = e.baseState, o === null) e.memoizedState = u;
    else {
      t = o.next;
      var S = d = null, D = null, K = t, ee = !1;
      do {
        var se = K.lane & -536870913;
        if (se !== K.lane ? (yt & se) === se : (Wa & se) === se) {
          var Y = K.revertLane;
          if (Y === 0)
            D !== null && (D = D.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: K.action,
              hasEagerState: K.hasEagerState,
              eagerState: K.eagerState,
              next: null
            }), se === ro && (ee = !0);
          else if ((Wa & Y) === Y) {
            K = K.next, Y === ro && (ee = !0);
            continue;
          } else
            se = {
              lane: 0,
              revertLane: K.revertLane,
              gesture: null,
              action: K.action,
              hasEagerState: K.hasEagerState,
              eagerState: K.eagerState,
              next: null
            }, D === null ? (S = D = se, d = u) : D = D.next = se, ot.lanes |= Y, zi |= Y;
          se = K.action, mo && n(u, se), u = K.hasEagerState ? K.eagerState : n(u, se);
        } else
          Y = {
            lane: se,
            revertLane: K.revertLane,
            gesture: K.gesture,
            action: K.action,
            hasEagerState: K.hasEagerState,
            eagerState: K.eagerState,
            next: null
          }, D === null ? (S = D = Y, d = u) : D = D.next = Y, ot.lanes |= se, zi |= se;
        K = K.next;
      } while (K !== null && K !== t);
      if (D === null ? d = u : D.next = S, !Dl(u, e.memoizedState) && (En = !0, ee && (n = Go, n !== null)))
        throw n;
      e.memoizedState = u, e.baseState = d, e.baseQueue = D, a.lastRenderedState = u;
    }
    return o === null && (a.lanes = 0), [e.memoizedState, a.dispatch];
  }
  function Gf(e) {
    var t = hn(), n = t.queue;
    if (n === null) throw Error(s(311));
    n.lastRenderedReducer = e;
    var a = n.dispatch, o = n.pending, u = t.memoizedState;
    if (o !== null) {
      n.pending = null;
      var d = o = o.next;
      do
        u = e(u, d.action), d = d.next;
      while (d !== o);
      Dl(u, t.memoizedState) || (En = !0), t.memoizedState = u, t.baseQueue === null && (t.baseState = u), n.lastRenderedState = u;
    }
    return [u, a];
  }
  function Qg(e, t, n) {
    var a = ot, o = hn(), u = st;
    if (u) {
      if (n === void 0) throw Error(s(407));
      n = n();
    } else n = t();
    var d = !Dl(
      (Lt || o).memoizedState,
      n
    );
    if (d && (o.memoizedState = n, En = !0), o = o.queue, Xf(Jg.bind(null, a, o, e), [
      e
    ]), e = o.getSnapshot !== t || d || Sn !== null && (Sn.memoizedState.tag & 1) !== 0, Po(
      e ? 9 : 8,
      { destroy: void 0 },
      Fg.bind(null, a, o, n, t),
      null
    ), e) {
      if (a.flags |= 2048, Gt === null) throw Error(s(349));
      u || (Wa & 127) !== 0 || Zg(a, t, n);
    }
    return n;
  }
  function Zg(e, t, n) {
    e.flags |= 16384, e = { getSnapshot: t, value: n }, t = ot.updateQueue, t === null ? (t = ns(), ot.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
  }
  function Fg(e, t, n, a) {
    t.value = n, t.getSnapshot = a, $g(t) && Wg(e);
  }
  function Jg(e, t, n) {
    return n(function() {
      $g(t) && Wg(e);
    });
  }
  function $g(e) {
    var t = e.getSnapshot;
    e = e.value;
    try {
      var n = t();
      return !Dl(e, n);
    } catch {
      return !0;
    }
  }
  function Wg(e) {
    var t = to(e, 2);
    t !== null && Al(t, e, 2);
  }
  function Yf(e) {
    var t = hl();
    if (typeof e == "function") {
      var n = e;
      if (e = n(), mo) {
        lt(!0);
        try {
          n();
        } finally {
          lt(!1);
        }
      }
    }
    return t.memoizedState = t.baseState = e, t.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: ei,
      lastRenderedState: e
    }, t;
  }
  function eh(e, t, n, a) {
    return e.baseState = n, qf(
      e,
      Lt,
      typeof a == "function" ? a : ei
    );
  }
  function Tx(e, t, n, a, o) {
    if (rs(e)) throw Error(s(485));
    if (e = t.action, e !== null) {
      var u = {
        payload: o,
        action: e,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(d) {
          u.listeners.push(d);
        }
      };
      pe.T !== null ? n(!0) : u.isTransition = !1, a(u), n = t.pending, n === null ? (u.next = t.pending = u, th(t, u)) : (u.next = n.next, t.pending = n.next = u);
    }
  }
  function th(e, t) {
    var n = t.action, a = t.payload, o = e.state;
    if (t.isTransition) {
      var u = pe.T, d = {};
      d.types = u !== null ? u.types : null, pe.T = d;
      try {
        var S = n(o, a), D = pe.S;
        D !== null && D(d, S), nh(e, t, S);
      } catch (K) {
        kf(e, t, K);
      } finally {
        u !== null && d.types !== null && (u.types = d.types), pe.T = u;
      }
    } else
      try {
        u = n(o, a), nh(e, t, u);
      } catch (K) {
        kf(e, t, K);
      }
  }
  function nh(e, t, n) {
    n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(
      function(a) {
        lh(e, t, a);
      },
      function(a) {
        return kf(e, t, a);
      }
    ) : lh(e, t, n);
  }
  function lh(e, t, n) {
    t.status = "fulfilled", t.value = n, ah(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, th(e, n)));
  }
  function kf(e, t, n) {
    var a = e.pending;
    if (e.pending = null, a !== null) {
      a = a.next;
      do
        t.status = "rejected", t.reason = n, ah(t), t = t.next;
      while (t !== a);
    }
    e.action = null;
  }
  function ah(e) {
    e = e.listeners;
    for (var t = 0; t < e.length; t++) (0, e[t])();
  }
  function ih(e, t) {
    return t;
  }
  function oh(e, t) {
    if (st) {
      var n = Gt.formState;
      if (n !== null) {
        e: {
          var a = ot;
          if (st) {
            if (Kt) {
              t: {
                for (var o = Kt, u = Ql; o.nodeType !== 8; ) {
                  if (!u) {
                    o = null;
                    break t;
                  }
                  if (o = Fl(
                    o.nextSibling
                  ), o === null) {
                    o = null;
                    break t;
                  }
                }
                u = o.data, o = u === "F!" || u === "F" ? o : null;
              }
              if (o) {
                Kt = Fl(
                  o.nextSibling
                ), a = o.data === "F!";
                break e;
              }
            }
            xi(a);
          }
          a = !1;
        }
        a && (t = n[0]);
      }
    }
    return n = hl(), n.memoizedState = n.baseState = t, a = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: ih,
      lastRenderedState: t
    }, n.queue = a, n = Th.bind(
      null,
      ot,
      a
    ), a.dispatch = n, a = Yf(!1), u = Ff.bind(
      null,
      ot,
      !1,
      a.queue
    ), a = hl(), o = {
      state: t,
      dispatch: null,
      action: e,
      pending: null
    }, a.queue = o, n = Tx.bind(
      null,
      ot,
      o,
      u,
      n
    ), o.dispatch = n, a.memoizedState = e, [t, n, !1];
  }
  function rh(e) {
    var t = hn();
    return uh(t, Lt, e);
  }
  function uh(e, t, n) {
    if (t = qf(
      e,
      t,
      ih
    )[0], e = as(ei)[0], typeof t == "object" && t !== null && typeof t.then == "function")
      try {
        var a = Kr(t);
      } catch (d) {
        throw d === Yo ? Qu : d;
      }
    else a = t;
    t = hn();
    var o = t.queue, u = o.dispatch;
    return n !== t.memoizedState && (ot.flags |= 2048, Po(
      9,
      { destroy: void 0 },
      Ax.bind(null, o, n),
      null
    )), [a, u, e];
  }
  function Ax(e, t) {
    e.action = t;
  }
  function sh(e) {
    var t = hn(), n = Lt;
    if (n !== null)
      return uh(t, n, e);
    hn(), t = t.memoizedState, n = hn();
    var a = n.queue.dispatch;
    return n.memoizedState = e, [t, a, !1];
  }
  function Po(e, t, n, a) {
    return e = { tag: e, create: n, deps: a, inst: t, next: null }, t = ot.updateQueue, t === null && (t = ns(), ot.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (a = n.next, n.next = e, e.next = a, t.lastEffect = e), e;
  }
  function ch() {
    return hn().memoizedState;
  }
  function is(e, t, n, a) {
    var o = hl();
    ot.flags |= e, o.memoizedState = Po(
      1 | t,
      { destroy: void 0 },
      n,
      a === void 0 ? null : a
    );
  }
  function os(e, t, n, a) {
    var o = hn();
    a = a === void 0 ? null : a;
    var u = o.memoizedState.inst;
    Lt !== null && a !== null && Hf(a, Lt.memoizedState.deps) ? o.memoizedState = Po(t, u, n, a) : (ot.flags |= e, o.memoizedState = Po(
      1 | t,
      u,
      n,
      a
    ));
  }
  function fh(e, t) {
    is(8390656, 8, e, t);
  }
  function Xf(e, t) {
    os(2048, 8, e, t);
  }
  function Ox(e) {
    ot.flags |= 4;
    var t = ot.updateQueue;
    if (t === null)
      t = ns(), ot.updateQueue = t, t.events = [e];
    else {
      var n = t.events;
      n === null ? t.events = [e] : n.push(e);
    }
  }
  function dh(e) {
    var t = hn().memoizedState;
    return Ox({ ref: t, nextImpl: e }), function() {
      if ((Dt & 2) !== 0) throw Error(s(440));
      return t.impl.apply(void 0, arguments);
    };
  }
  function mh(e, t) {
    return os(4, 2, e, t);
  }
  function gh(e, t) {
    return os(4, 4, e, t);
  }
  function hh(e, t) {
    if (typeof t == "function") {
      e = e();
      var n = t(e);
      return function() {
        typeof n == "function" ? n() : t(null);
      };
    }
    if (t != null)
      return e = e(), t.current = e, function() {
        t.current = null;
      };
  }
  function ph(e, t, n) {
    n = n != null ? n.concat([e]) : null, os(4, 4, hh.bind(null, t, e), n);
  }
  function Kf() {
  }
  function vh(e, t) {
    var n = hn();
    t = t === void 0 ? null : t;
    var a = n.memoizedState;
    return t !== null && Hf(t, a[1]) ? a[0] : (n.memoizedState = [e, t], e);
  }
  function bh(e, t) {
    var n = hn();
    t = t === void 0 ? null : t;
    var a = n.memoizedState;
    if (t !== null && Hf(t, a[1]))
      return a[0];
    if (a = e(), mo) {
      lt(!0);
      try {
        e();
      } finally {
        lt(!1);
      }
    }
    return n.memoizedState = [a, t], a;
  }
  function Pf(e, t, n) {
    return n === void 0 || (Wa & 1073741824) !== 0 && (yt & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = n, e = wp(), ot.lanes |= e, zi |= e, n);
  }
  function yh(e, t, n, a) {
    return Dl(n, t) ? n : Ai.current !== null ? (e = Pf(e, n, a), Dl(e, t) || (En = !0), e) : (Wa & 106) === 0 || (Wa & 1073741824) !== 0 && (yt & 261930) === 0 ? (En = !0, e.memoizedState = n) : (e = wp(), ot.lanes |= e, zi |= e, t);
  }
  function xh(e, t, n, a, o) {
    var u = xe.p;
    xe.p = u !== 0 && 8 > u ? u : 8;
    var d = pe.T, S = {};
    S.types = d !== null ? d.types : null, pe.T = S, Ff(e, !1, t, n);
    try {
      var D = o(), K = pe.S;
      if (K !== null && K(S, D), D !== null && typeof D == "object" && typeof D.then == "function") {
        var ee = Ex(
          D,
          a
        );
        Pr(
          e,
          t,
          ee,
          Ul(e)
        );
      } else
        Pr(
          e,
          t,
          a,
          Ul(e)
        );
    } catch (se) {
      Pr(
        e,
        t,
        { then: function() {
        }, status: "rejected", reason: se },
        Ul()
      );
    } finally {
      xe.p = u, d !== null && S.types !== null && (d.types = S.types), pe.T = d;
    }
  }
  function wx() {
  }
  function Qf(e, t, n, a) {
    if (e.tag !== 5) throw Error(s(476));
    var o = Sh(e).queue;
    xh(
      e,
      o,
      t,
      Ke,
      n === null ? wx : function() {
        return Eh(e), n(a);
      }
    );
  }
  function Sh(e) {
    var t = e.memoizedState;
    if (t !== null) return t;
    t = {
      memoizedState: Ke,
      baseState: Ke,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: ei,
        lastRenderedState: Ke
      },
      next: null
    };
    var n = {};
    return t.next = {
      memoizedState: n,
      baseState: n,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: ei,
        lastRenderedState: n
      },
      next: null
    }, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
  }
  function Eh(e) {
    var t = Sh(e);
    t.next === null && (t = e.alternate.memoizedState), Pr(
      e,
      t.next.queue,
      {},
      Ul()
    );
  }
  function Zf() {
    return Kn(dr);
  }
  function Ch() {
    return hn().memoizedState;
  }
  function Rh() {
    return hn().memoizedState;
  }
  function Mx(e) {
    for (var t = e.return; t !== null; ) {
      switch (t.tag) {
        case 24:
        case 3:
          var n = Ul();
          e = Ri(n);
          var a = Ti(t, e, n);
          a !== null && (Al(a, t, n), qr(a, t, n)), t = { cache: Cf() }, e.payload = t;
          return;
      }
      t = t.return;
    }
  }
  function Nx(e, t, n) {
    var a = Ul();
    n = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, rs(e) ? Ah(t, n) : (n = gf(e, t, n, a), n !== null && (Al(n, e, a), Oh(n, t, a)));
  }
  function Th(e, t, n) {
    var a = Ul();
    Pr(e, t, n, a);
  }
  function Pr(e, t, n, a) {
    var o = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (rs(e)) Ah(t, o);
    else {
      var u = e.alternate;
      if (e.lanes === 0 && (u === null || u.lanes === 0) && (u = t.lastRenderedReducer, u !== null))
        try {
          var d = t.lastRenderedState, S = u(d, n);
          if (o.hasEagerState = !0, o.eagerState = S, Dl(S, d))
            return Vu(e, t, o, 0), Gt === null && Iu(), !1;
        } catch {
        }
      if (n = gf(e, t, o, a), n !== null)
        return Al(n, e, a), Oh(n, t, a), !0;
    }
    return !1;
  }
  function Ff(e, t, n, a) {
    if (a = {
      lane: 2,
      revertLane: Bd(),
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, rs(e)) {
      if (t) throw Error(s(479));
    } else
      t = gf(
        e,
        n,
        a,
        2
      ), t !== null && Al(t, e, 2);
  }
  function rs(e) {
    var t = e.alternate;
    return e === ot || t !== null && t === ot;
  }
  function Ah(e, t) {
    Xo = es = !0;
    var n = e.pending;
    n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
  }
  function Oh(e, t, n) {
    if ((n & 4194048) !== 0) {
      var a = t.lanes;
      a &= e.pendingLanes, n |= a, t.lanes = n, Gl(e, n);
    }
  }
  var us = {
    readContext: Kn,
    use: ls,
    useCallback: fn,
    useContext: fn,
    useEffect: fn,
    useImperativeHandle: fn,
    useLayoutEffect: fn,
    useInsertionEffect: fn,
    useMemo: fn,
    useReducer: fn,
    useRef: fn,
    useState: fn,
    useDebugValue: fn,
    useDeferredValue: fn,
    useTransition: fn,
    useSyncExternalStore: fn,
    useId: fn,
    useHostTransitionStatus: fn,
    useFormState: fn,
    useActionState: fn,
    useOptimistic: fn,
    useMemoCache: fn,
    useCacheRefresh: fn,
    useEffectEvent: fn
  }, wh = {
    readContext: Kn,
    use: ls,
    useCallback: function(e, t) {
      return hl().memoizedState = [
        e,
        t === void 0 ? null : t
      ], e;
    },
    useContext: Kn,
    useEffect: fh,
    useImperativeHandle: function(e, t, n) {
      n = n != null ? n.concat([e]) : null, is(
        4194308,
        4,
        hh.bind(null, t, e),
        n
      );
    },
    useLayoutEffect: function(e, t) {
      return is(4194308, 4, e, t);
    },
    useInsertionEffect: function(e, t) {
      is(4, 2, e, t);
    },
    useMemo: function(e, t) {
      var n = hl();
      t = t === void 0 ? null : t;
      var a = e();
      if (mo) {
        lt(!0);
        try {
          e();
        } finally {
          lt(!1);
        }
      }
      return n.memoizedState = [a, t], a;
    },
    useReducer: function(e, t, n) {
      var a = hl();
      if (n !== void 0) {
        var o = n(t);
        if (mo) {
          lt(!0);
          try {
            n(t);
          } finally {
            lt(!1);
          }
        }
      } else o = t;
      return a.memoizedState = a.baseState = o, e = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: e,
        lastRenderedState: o
      }, a.queue = e, e = e.dispatch = Nx.bind(
        null,
        ot,
        e
      ), [a.memoizedState, e];
    },
    useRef: function(e) {
      var t = hl();
      return e = { current: e }, t.memoizedState = e;
    },
    useState: function(e) {
      e = Yf(e);
      var t = e.queue, n = Th.bind(null, ot, t);
      return t.dispatch = n, [e.memoizedState, n];
    },
    useDebugValue: Kf,
    useDeferredValue: function(e, t) {
      var n = hl();
      return Pf(n, e, t);
    },
    useTransition: function() {
      var e = Yf(!1);
      return e = xh.bind(
        null,
        ot,
        e.queue,
        !0,
        !1
      ), hl().memoizedState = e, [!1, e];
    },
    useSyncExternalStore: function(e, t, n) {
      var a = ot, o = hl();
      if (st) {
        if (n === void 0)
          throw Error(s(407));
        n = n();
      } else {
        if (n = t(), Gt === null)
          throw Error(s(349));
        (yt & 127) !== 0 || Zg(a, t, n);
      }
      o.memoizedState = n;
      var u = { value: n, getSnapshot: t };
      return o.queue = u, fh(Jg.bind(null, a, u, e), [
        e
      ]), a.flags |= 2048, Po(
        9,
        { destroy: void 0 },
        Fg.bind(
          null,
          a,
          u,
          n,
          t
        ),
        null
      ), n;
    },
    useId: function() {
      var e = hl(), t = Gt.identifierPrefix;
      if (st) {
        var n = xa, a = ya;
        n = (a & ~(1 << 32 - pt(a) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = ts++, 0 < n && (t += "H" + n.toString(32)), t += "_";
      } else
        n = Cx++, t = "_" + t + "r_" + n.toString(32) + "_";
      return e.memoizedState = t;
    },
    useHostTransitionStatus: Zf,
    useFormState: oh,
    useActionState: oh,
    useOptimistic: function(e) {
      var t = hl();
      t.memoizedState = t.baseState = e;
      var n = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return t.queue = n, t = Ff.bind(
        null,
        ot,
        !0,
        n
      ), n.dispatch = t, [e, t];
    },
    useMemoCache: Bf,
    useCacheRefresh: function() {
      return hl().memoizedState = Mx.bind(
        null,
        ot
      );
    },
    useEffectEvent: function(e) {
      var t = hl(), n = { impl: e };
      return t.memoizedState = n, function() {
        if ((Dt & 2) !== 0)
          throw Error(s(440));
        return n.impl.apply(void 0, arguments);
      };
    }
  }, Mh = {
    readContext: Kn,
    use: ls,
    useCallback: vh,
    useContext: Kn,
    useEffect: Xf,
    useImperativeHandle: ph,
    useInsertionEffect: mh,
    useLayoutEffect: gh,
    useMemo: bh,
    useReducer: as,
    useRef: ch,
    useState: function() {
      return as(ei);
    },
    useDebugValue: Kf,
    useDeferredValue: function(e, t) {
      var n = hn();
      return yh(
        n,
        Lt.memoizedState,
        e,
        t
      );
    },
    useTransition: function() {
      var e = as(ei)[0], t = hn().memoizedState;
      return [
        typeof e == "boolean" ? e : Kr(e),
        t
      ];
    },
    useSyncExternalStore: Qg,
    useId: Ch,
    useHostTransitionStatus: Zf,
    useFormState: rh,
    useActionState: rh,
    useOptimistic: function(e, t) {
      var n = hn();
      return eh(n, Lt, e, t);
    },
    useMemoCache: Bf,
    useCacheRefresh: Rh,
    useEffectEvent: dh
  }, Dx = {
    readContext: Kn,
    use: ls,
    useCallback: vh,
    useContext: Kn,
    useEffect: Xf,
    useImperativeHandle: ph,
    useInsertionEffect: mh,
    useLayoutEffect: gh,
    useMemo: bh,
    useReducer: Gf,
    useRef: ch,
    useState: function() {
      return Gf(ei);
    },
    useDebugValue: Kf,
    useDeferredValue: function(e, t) {
      var n = hn();
      return Lt === null ? Pf(n, e, t) : yh(
        n,
        Lt.memoizedState,
        e,
        t
      );
    },
    useTransition: function() {
      var e = Gf(ei)[0], t = hn().memoizedState;
      return [
        typeof e == "boolean" ? e : Kr(e),
        t
      ];
    },
    useSyncExternalStore: Qg,
    useId: Ch,
    useHostTransitionStatus: Zf,
    useFormState: sh,
    useActionState: sh,
    useOptimistic: function(e, t) {
      var n = hn();
      return Lt !== null ? eh(n, Lt, e, t) : (n.baseState = e, [e, n.queue.dispatch]);
    },
    useMemoCache: Bf,
    useCacheRefresh: Rh,
    useEffectEvent: dh
  };
  function Jf(e, t, n, a) {
    t = e.memoizedState, n = n(a, t), n = n == null ? t : _({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
  }
  var $f = {
    enqueueSetState: function(e, t, n) {
      e = e._reactInternals;
      var a = Ul(), o = Ri(a);
      o.payload = t, n != null && (o.callback = n), t = Ti(e, o, a), t !== null && (Al(t, e, a), qr(t, e, a));
    },
    enqueueReplaceState: function(e, t, n) {
      e = e._reactInternals;
      var a = Ul(), o = Ri(a);
      o.tag = 1, o.payload = t, n != null && (o.callback = n), t = Ti(e, o, a), t !== null && (Al(t, e, a), qr(t, e, a));
    },
    enqueueForceUpdate: function(e, t) {
      e = e._reactInternals;
      var n = Ul(), a = Ri(n);
      a.tag = 2, t != null && (a.callback = t), t = Ti(e, a, n), t !== null && (Al(t, e, n), qr(t, e, n));
    }
  };
  function Nh(e, t, n, a, o, u, d) {
    return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(a, u, d) : t.prototype && t.prototype.isPureReactComponent ? !_r(n, a) || !_r(o, u) : !0;
  }
  function Dh(e, t, n, a) {
    e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, a), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, a), t.state !== e && $f.enqueueReplaceState(t, t.state, null);
  }
  function go(e, t) {
    var n = t;
    if ("ref" in t) {
      n = {};
      for (var a in t)
        a !== "ref" && (n[a] = t[a]);
    }
    if (e = e.defaultProps) {
      n === t && (n = _({}, n));
      for (var o in e)
        n[o] === void 0 && (n[o] = e[o]);
    }
    return n;
  }
  function zh(e) {
    Uu(e);
  }
  function _h(e) {
    console.error(e);
  }
  function jh(e) {
    Uu(e);
  }
  function ss(e, t) {
    try {
      var n = e.onUncaughtError;
      n(t.value, { componentStack: t.stack });
    } catch (a) {
      setTimeout(function() {
        throw a;
      });
    }
  }
  function Hh(e, t, n) {
    try {
      var a = e.onCaughtError;
      a(n.value, {
        componentStack: n.stack,
        errorBoundary: t.tag === 1 ? t.stateNode : null
      });
    } catch (o) {
      setTimeout(function() {
        throw o;
      });
    }
  }
  function Wf(e, t, n) {
    return n = Ri(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
      ss(e, t);
    }, n;
  }
  function Uh(e) {
    return e = Ri(e), e.tag = 3, e;
  }
  function Ih(e, t, n, a) {
    var o = n.type.getDerivedStateFromError;
    if (typeof o == "function") {
      var u = a.value;
      e.payload = function() {
        return o(u);
      }, e.callback = function() {
        Hh(t, n, a);
      };
    }
    var d = n.stateNode;
    d !== null && typeof d.componentDidCatch == "function" && (e.callback = function() {
      Hh(t, n, a), typeof o != "function" && (_i === null ? _i = /* @__PURE__ */ new Set([this]) : _i.add(this));
      var S = a.stack;
      this.componentDidCatch(a.value, {
        componentStack: S !== null ? S : ""
      });
    });
  }
  function zx(e, t, n, a, o) {
    if (n.flags |= 32768, a !== null && typeof a == "object" && typeof a.then == "function") {
      if (t = n.alternate, t !== null && io(
        t,
        n,
        o,
        !0
      ), n = Pn.current, n !== null) {
        switch (n.tag) {
          case 31:
          case 13:
          case 19:
            return rl === null ? Ns() : n.alternate === null && dn === 0 && (dn = 3), n.flags &= -257, n.flags |= 65536, n.lanes = o, a === Zu ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([a]) : t.add(a), Id(e, a, o)), !1;
          case 22:
            return n.flags |= 65536, a === Zu ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([a])
            }, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([a]) : n.add(a)), Id(e, a, o)), !1;
        }
        throw Error(s(435, n.tag));
      }
      return Id(e, a, o), Ns(), !1;
    }
    if (st)
      return t = Pn.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = o, a !== yf && (e = Error(s(422), { cause: a }), Ur(Xl(e, n)))) : (a !== yf && (t = Error(s(423), {
        cause: a
      }), Ur(
        Xl(t, n)
      )), e = e.current.alternate, e.flags |= 65536, o &= -o, e.lanes |= o, a = Xl(a, n), o = Wf(
        e.stateNode,
        a,
        o
      ), Mf(e, o), dn !== 4 && (dn = 2)), !1;
    var u = Error(s(520), { cause: a });
    if (u = Xl(u, n), tu === null ? tu = [u] : tu.push(u), dn !== 4 && (dn = 2), t === null) return !0;
    a = Xl(a, n), n = t;
    do {
      switch (n.tag) {
        case 3:
          return n.flags |= 65536, e = o & -o, n.lanes |= e, e = Wf(n.stateNode, a, e), Mf(n, e), !1;
        case 1:
          if (t = n.type, u = n.stateNode, (n.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (_i === null || !_i.has(u))))
            return n.flags |= 65536, o &= -o, n.lanes |= o, o = Uh(o), Ih(
              o,
              e,
              n,
              a
            ), Mf(n, o), !1;
          break;
        case 22:
          if (n.memoizedState !== null)
            return n.flags |= 65536, !1;
      }
      n = n.return;
    } while (n !== null);
    return !1;
  }
  var ed = Error(s(461)), En = !1;
  function Dn(e, t, n, a) {
    t.child = e === null ? qg(t, null, n, a) : fo(
      t,
      e.child,
      n,
      a
    );
  }
  function Vh(e, t, n, a, o) {
    n = n.render;
    var u = t.ref;
    if ("ref" in a) {
      var d = {};
      for (var S in a)
        S !== "ref" && (d[S] = a[S]);
    } else d = a;
    return oo(t), a = Uf(
      e,
      t,
      n,
      d,
      u,
      o
    ), S = If(), e !== null && !En ? (Vf(e, t, o), ti(e, t, o)) : (st && S && Gu(t), t.flags |= 1, Dn(e, t, a, o), t.child);
  }
  function Lh(e, t, n, a, o) {
    if (e === null) {
      var u = n.type;
      return typeof u == "function" && !hf(u) && u.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = u, Bh(
        e,
        t,
        u,
        a,
        o
      )) : (e = Bu(
        n.type,
        null,
        a,
        t,
        t.mode,
        o
      ), e.ref = t.ref, e.return = t, t.child = e);
    }
    if (u = e.child, !ud(e, o)) {
      var d = u.memoizedProps;
      if (n = n.compare, n = n !== null ? n : _r, n(d, a) && e.ref === t.ref)
        return ti(e, t, o);
    }
    return t.flags |= 1, e = Za(u, a), e.ref = t.ref, e.return = t, t.child = e;
  }
  function Bh(e, t, n, a, o) {
    if (e !== null) {
      var u = e.memoizedProps;
      if (_r(u, a) && e.ref === t.ref)
        if (En = !1, t.pendingProps = a = u, ud(e, o))
          (e.flags & 131072) !== 0 && (En = !0);
        else
          return t.lanes = e.lanes, ti(e, t, o);
    }
    return td(
      e,
      t,
      n,
      a,
      o
    );
  }
  function qh(e, t, n, a) {
    var o = a.children, u = e !== null ? e.memoizedState : null;
    if (e === null && t.stateNode === null && (t.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), a.mode === "hidden") {
      if ((t.flags & 128) !== 0) {
        if (u = u !== null ? u.baseLanes | n : n, e !== null) {
          for (a = t.child = e.child, o = 0; a !== null; )
            o = o | a.lanes | a.childLanes, a = a.sibling;
          a = o & ~u;
        } else a = 0, t.child = null;
        return Gh(
          e,
          t,
          u,
          n,
          a
        );
      }
      if ((n & 536870912) !== 0)
        t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && Pu(
          t,
          u !== null ? u.cachePool : null
        ), u !== null ? kg(t, u) : Df(), Xg(t);
      else
        return a = t.lanes = 536870912, Gh(
          e,
          t,
          u !== null ? u.baseLanes | n : n,
          n,
          a
        );
    } else
      u !== null ? (Pu(t, u.cachePool), kg(t, u), wi(), t.memoizedState = null) : (e !== null && Pu(t, null), Df(), wi());
    return Dn(e, t, o, n), t.child;
  }
  function Qr(e, t) {
    return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), t.sibling;
  }
  function Gh(e, t, n, a, o) {
    var u = Tf();
    return u = u === null ? null : { parent: xn._currentValue, pool: u }, t.memoizedState = {
      baseLanes: n,
      cachePool: u
    }, e !== null && Pu(t, null), Df(), Xg(t), e !== null && io(e, t, a, !0), t.childLanes = o, null;
  }
  function cs(e, t) {
    return t = fs(
      { mode: t.mode, children: t.children },
      e.mode
    ), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function Yh(e, t, n) {
    return fo(t, e.child, null, n), e = cs(t, t.pendingProps), e.flags |= 2, zl(t), t.memoizedState = null, e;
  }
  function _x(e, t, n) {
    var a = t.pendingProps, o = (t.flags & 128) !== 0;
    if (t.flags &= -129, e === null) {
      if (st) {
        if (a.mode === "hidden")
          return e = cs(t, a), t.lanes = 536870912, e.memoizedState = { baseLanes: 0, cachePool: null }, Qr(null, e);
        if (_f(t), (e = Kt) ? (e = hv(
          e,
          Ql
        ), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
          dehydrated: e,
          treeContext: bi !== null ? { id: ya, overflow: xa } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, n = Ag(e), n.return = t, t.child = n, Bn = t, Kt = null)) : e = null, e === null) throw xi(t);
        return t.lanes = 536870912, null;
      }
      return cs(t, a);
    }
    var u = e.memoizedState;
    if (u !== null) {
      var d = u.dehydrated;
      if (_f(t), o)
        if (t.flags & 256)
          t.flags &= -257, t = Yh(
            e,
            t,
            n
          );
        else if (t.memoizedState !== null)
          t.child = e.child, t.flags |= 128, t = null;
        else throw Error(s(558));
      else if (En || io(e, t, n, !1), o = (n & e.childLanes) !== 0, En || o) {
        if (Ai.current === null) {
          if (a = Gt, a !== null && (d = tn(a, n), d !== 0 && d !== u.retryLane))
            throw u.retryLane = d, to(e, d), Al(a, e, d), ed;
          Ns();
        }
        t = Yh(
          e,
          t,
          n
        );
      } else
        e = u.treeContext, Kt = Fl(d.nextSibling), Bn = t, st = !0, yi = null, Ql = !1, e !== null && Mg(t, e), t = cs(t, a), t.flags |= 134221824;
      return t;
    }
    return e = Za(e.child, {
      mode: a.mode,
      children: a.children
    }), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function Qo(e, t) {
    var n = t.ref;
    if (n === null)
      e !== null && e.ref !== null && (t.flags |= 4194816);
    else {
      if (typeof n != "function" && typeof n != "object")
        throw Error(s(284));
      (e === null || e.ref !== n) && (t.flags |= 4194816);
    }
  }
  function td(e, t, n, a, o) {
    return oo(t), n = Uf(
      e,
      t,
      n,
      a,
      void 0,
      o
    ), a = If(), e !== null && !En ? (Vf(e, t, o), ti(e, t, o)) : (st && a && Gu(t), t.flags |= 1, Dn(e, t, n, o), t.child);
  }
  function kh(e, t, n, a, o, u) {
    return oo(t), t.updateQueue = null, n = Pg(
      t,
      a,
      n,
      o
    ), Kg(e), a = If(), e !== null && !En ? (Vf(e, t, u), ti(e, t, u)) : (st && a && Gu(t), t.flags |= 1, Dn(e, t, n, u), t.child);
  }
  function Xh(e, t, n, a, o) {
    if (oo(t), t.stateNode === null) {
      var u = Vo, d = n.contextType;
      typeof d == "object" && d !== null && (u = Kn(d)), u = new n(a, u), t.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = $f, t.stateNode = u, u._reactInternals = t, u = t.stateNode, u.props = a, u.state = t.memoizedState, u.refs = {}, Of(t), d = n.contextType, u.context = typeof d == "object" && d !== null ? Kn(d) : Vo, u.state = t.memoizedState, d = n.getDerivedStateFromProps, typeof d == "function" && (Jf(
        t,
        n,
        d,
        a
      ), u.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (d = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), d !== u.state && $f.enqueueReplaceState(u, u.state, null), Yr(t, a, u, o), Gr(), u.state = t.memoizedState), typeof u.componentDidMount == "function" && (t.flags |= 4194308), a = !0;
    } else if (e === null) {
      u = t.stateNode;
      var S = t.memoizedProps, D = go(n, S);
      u.props = D;
      var K = u.context, ee = n.contextType;
      d = Vo, typeof ee == "object" && ee !== null && (d = Kn(ee));
      var se = n.getDerivedStateFromProps;
      ee = typeof se == "function" || typeof u.getSnapshotBeforeUpdate == "function", S = t.pendingProps !== S, ee || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (S || K !== d) && Dh(
        t,
        u,
        a,
        d
      ), Ci = !1;
      var Y = t.memoizedState;
      u.state = Y, Yr(t, a, u, o), Gr(), K = t.memoizedState, S || Y !== K || Ci ? (typeof se == "function" && (Jf(
        t,
        n,
        se,
        a
      ), K = t.memoizedState), (D = Ci || Nh(
        t,
        n,
        D,
        a,
        Y,
        K,
        d
      )) ? (ee || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = a, t.memoizedState = K), u.props = a, u.state = K, u.context = d, a = D) : (typeof u.componentDidMount == "function" && (t.flags |= 4194308), a = !1);
    } else {
      u = t.stateNode, wf(e, t), d = t.memoizedProps, ee = go(n, d), u.props = ee, se = t.pendingProps, Y = u.context, K = n.contextType, D = Vo, typeof K == "object" && K !== null && (D = Kn(K)), S = n.getDerivedStateFromProps, (K = typeof S == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (d !== se || Y !== D) && Dh(
        t,
        u,
        a,
        D
      ), Ci = !1, Y = t.memoizedState, u.state = Y, Yr(t, a, u, o), Gr();
      var F = t.memoizedState;
      d !== se || Y !== F || Ci || e !== null && e.dependencies !== null && Xu(e.dependencies) ? (typeof S == "function" && (Jf(
        t,
        n,
        S,
        a
      ), F = t.memoizedState), (ee = Ci || Nh(
        t,
        n,
        ee,
        a,
        Y,
        F,
        D
      ) || e !== null && e.dependencies !== null && Xu(e.dependencies)) ? (K || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(a, F, D), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
        a,
        F,
        D
      )), typeof u.componentDidUpdate == "function" && (t.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || d === e.memoizedProps && Y === e.memoizedState || (t.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || d === e.memoizedProps && Y === e.memoizedState || (t.flags |= 1024), t.memoizedProps = a, t.memoizedState = F), u.props = a, u.state = F, u.context = D, a = ee) : (typeof u.componentDidUpdate != "function" || d === e.memoizedProps && Y === e.memoizedState || (t.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || d === e.memoizedProps && Y === e.memoizedState || (t.flags |= 1024), a = !1);
    }
    return u = a, Qo(e, t), a = (t.flags & 128) !== 0, u || a ? (u = t.stateNode, n = a && typeof n.getDerivedStateFromError != "function" ? null : u.render(), t.flags |= 1, e !== null && a ? (t.child = fo(
      t,
      e.child,
      null,
      o
    ), t.child = fo(
      t,
      null,
      n,
      o
    )) : Dn(e, t, n, o), t.memoizedState = u.state, e = t.child) : e = ti(
      e,
      t,
      o
    ), e;
  }
  function Kh(e, t, n, a) {
    return lo(), t.flags |= 256, Dn(e, t, n, a), t.child;
  }
  var nd = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function ld(e) {
    return { baseLanes: e, cachePool: Hg() };
  }
  function ad(e, t, n) {
    return e = e !== null ? e.childLanes & ~n : 0, t && (e |= Hl), e;
  }
  function Ph(e, t, n) {
    var a = t.pendingProps, o = !1, u = (t.flags & 128) !== 0, d;
    if ((d = u) || (d = e !== null && e.memoizedState === null ? !1 : (Qn.current & 2) !== 0), d && (o = !0, t.flags &= -129), d = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
      if (st) {
        if (o ? Oi(t) : wi(), (e = Kt) ? (e = hv(
          e,
          Ql
        ), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
          dehydrated: e,
          treeContext: bi !== null ? { id: ya, overflow: xa } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, n = Ag(e), n.return = t, t.child = n, Bn = t, Kt = null)) : e = null, e === null) throw xi(t);
        return lm(e) ? t.lanes = 32 : t.lanes = 536870912, null;
      }
      return u = a.children, a = a.fallback, o ? (wi(), o = t.mode, u = fs(
        { mode: "hidden", children: u },
        o
      ), a = no(
        a,
        o,
        n,
        null
      ), u.return = t, a.return = t, u.sibling = a, t.child = u, a = t.child, a.memoizedState = ld(n), a.childLanes = ad(
        e,
        d,
        n
      ), t.memoizedState = nd, Qr(null, a)) : (Oi(t), id(t, u));
    }
    var S = e.memoizedState;
    if (S !== null) {
      var D = S.dehydrated;
      if (D !== null)
        return jx(
          e,
          t,
          u,
          d,
          a,
          D,
          S,
          n
        );
    }
    return o ? (wi(), o = a.fallback, u = t.mode, S = e.child, D = S.sibling, a = Za(S, {
      mode: "hidden",
      children: a.children
    }), a.subtreeFlags = S.subtreeFlags & 1206910976, D !== null ? o = Za(D, o) : (o = no(
      o,
      u,
      n,
      null
    ), o.flags |= 2), o.return = t, a.return = t, a.sibling = o, t.child = a, Qr(null, a), a = t.child, o = e.child.memoizedState, o === null ? o = ld(n) : (u = o.cachePool, u !== null ? (S = xn._currentValue, u = u.parent !== S ? { parent: S, pool: S } : u) : u = Hg(), o = {
      baseLanes: o.baseLanes | n,
      cachePool: u
    }), a.memoizedState = o, a.childLanes = ad(
      e,
      d,
      n
    ), t.memoizedState = nd, Qr(e.child, a)) : (Oi(t), n = e.child, e = n.sibling, n = Za(n, {
      mode: "visible",
      children: a.children
    }), n.return = t, n.sibling = null, e !== null && (d = t.deletions, d === null ? (t.deletions = [e], t.flags |= 16) : d.push(e)), t.child = n, t.memoizedState = null, n);
  }
  function id(e, t) {
    return t = fs(
      { mode: "visible", children: t },
      e.mode
    ), t.return = e, e.child = t;
  }
  function fs(e, t) {
    return e = El(22, e, null, t), e.lanes = 0, e;
  }
  function ds(e, t, n) {
    return fo(t, e.child, null, n), e = id(
      t,
      t.pendingProps.children
    ), e.flags |= 2, t.memoizedState = null, e;
  }
  function jx(e, t, n, a, o, u, d, S) {
    if (n)
      return t.flags & 256 ? (Oi(t), t.flags &= -257, ds(
        e,
        t,
        S
      )) : t.memoizedState !== null ? (wi(), t.child = e.child, t.flags |= 128, null) : (wi(), u = o.fallback, d = t.mode, o = fs(
        { mode: "visible", children: o.children },
        d
      ), u = no(
        u,
        d,
        S,
        null
      ), u.flags |= 2, o.return = t, u.return = t, o.sibling = u, t.child = o, fo(t, e.child, null, S), o = t.child, o.memoizedState = ld(S), o.childLanes = ad(
        e,
        a,
        S
      ), t.memoizedState = nd, Qr(null, o));
    if (Oi(t), lm(u)) {
      if (a = u.nextSibling && u.nextSibling.dataset, a) var D = a.dgst;
      return a = D, a !== "" && (o = Error(s(419)), o.stack = "", o.digest = a, Ur({ value: o, source: null, stack: null })), ds(
        e,
        t,
        S
      );
    }
    if (En || io(e, t, S, !1), a = (S & e.childLanes) !== 0, En || a) {
      if (Ai.current !== null)
        return ds(
          e,
          t,
          S
        );
      if (a = Gt, a !== null && (o = tn(
        a,
        S
      ), o !== 0 && o !== d.retryLane))
        throw d.retryLane = o, to(e, o), Al(a, e, o), ed;
      return nm(u) || Ns(), ds(
        e,
        t,
        S
      );
    }
    return nm(u) ? (t.flags |= 192, t.child = e.child, null) : (e = d.treeContext, Kt = Fl(u.nextSibling), Bn = t, st = !0, yi = null, Ql = !1, e !== null && Mg(t, e), t = id(
      t,
      o.children
    ), t.flags |= 134221824, t);
  }
  function Qh(e, t, n) {
    e.lanes |= t;
    var a = e.alternate;
    a !== null && (a.lanes |= t), ku(e.return, t, n);
  }
  function Zh(e) {
    for (var t = null; e !== null; ) {
      var n = e.alternate;
      n !== null && Wu(n) === null && (t = e), e = e.sibling;
    }
    return t;
  }
  function ms(e, t, n, a, o, u) {
    var d = e.memoizedState;
    d === null ? e.memoizedState = {
      isBackwards: t,
      rendering: null,
      renderingStartTime: 0,
      last: a,
      tail: n,
      tailMode: o,
      treeForkCount: u
    } : (d.isBackwards = t, d.rendering = null, d.renderingStartTime = 0, d.last = a, d.tail = n, d.tailMode = o, d.treeForkCount = u);
  }
  function od(e) {
    var t = e.child;
    for (e.child = null; t !== null; ) {
      var n = t.sibling;
      t.sibling = e.child, e.child = t, t = n;
    }
  }
  function rd(e, t, n) {
    var a = t.pendingProps, o = a.revealOrder, u = a.tail;
    a = a.children;
    var d = Qn.current;
    if (t.flags & 128)
      return kr(t, d), null;
    var S = (d & 2) !== 0;
    if (S ? (d = d & 1 | 2, t.flags |= 128) : d &= 1, kr(t, d), o === "backwards" && e !== null ? (od(e), Dn(e, t, a, n), od(e)) : Dn(e, t, a, n), a = st ? Hr : 0, !S && e !== null && (e.flags & 128) !== 0)
      e: for (e = t.child; e !== null; ) {
        if (e.tag === 13)
          e.memoizedState !== null && Qh(e, n, t);
        else if (e.tag === 19)
          Qh(e, n, t);
        else if (e.child !== null) {
          e.child.return = e, e = e.child;
          continue;
        }
        if (e === t) break e;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t)
            break e;
          e = e.return;
        }
        e.sibling.return = e.return, e = e.sibling;
      }
    switch (o) {
      case "backwards":
        n = Zh(t.child), n === null ? (o = t.child, t.child = null) : (o = n.sibling, n.sibling = null, od(t)), ms(
          t,
          !0,
          o,
          null,
          u,
          a
        );
        break;
      case "unstable_legacy-backwards":
        for (n = null, o = t.child, t.child = null; o !== null; ) {
          if (e = o.alternate, e !== null && Wu(e) === null) {
            t.child = o;
            break;
          }
          e = o.sibling, o.sibling = n, n = o, o = e;
        }
        ms(
          t,
          !0,
          n,
          null,
          u,
          a
        );
        break;
      case "together":
        ms(
          t,
          !1,
          null,
          null,
          void 0,
          a
        );
        break;
      case "independent":
        t.memoizedState = null;
        break;
      default:
        n = Zh(t.child), n === null ? (o = t.child, t.child = null) : (o = n.sibling, n.sibling = null), ms(
          t,
          !1,
          o,
          n,
          u,
          a
        );
    }
    return t.child;
  }
  function Fh(e, t, n) {
    var a = t.pendingProps;
    return Si(t, t.type, a.value), Dn(e, t, a.children, n), t.child;
  }
  function ti(e, t, n) {
    if (e !== null && (t.dependencies = e.dependencies), zi |= t.lanes, (n & t.childLanes) === 0)
      if (e !== null) {
        if (io(
          e,
          t,
          n,
          !1
        ), (n & t.childLanes) === 0)
          return null;
      } else return null;
    if (e !== null && t.child !== e.child)
      throw Error(s(153));
    if (t.child !== null) {
      for (e = t.child, n = Za(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null; )
        e = e.sibling, n = n.sibling = Za(e, e.pendingProps), n.return = t;
      n.sibling = null;
    }
    return t.child;
  }
  function ud(e, t) {
    return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Xu(e)));
  }
  function Hx(e, t, n) {
    switch (t.tag) {
      case 3:
        je(t, t.stateNode.containerInfo), Si(t, xn, e.memoizedState.cache), lo();
        break;
      case 27:
      case 5:
        ne(t);
        break;
      case 4:
        je(t, t.stateNode.containerInfo);
        break;
      case 10:
        Si(
          t,
          t.type,
          t.memoizedProps.value
        );
        break;
      case 31:
        if (t.memoizedState !== null)
          return t.flags |= 128, _f(t), null;
        break;
      case 13:
        var a = t.memoizedState;
        if (a !== null) {
          if (a.dehydrated !== null)
            return Oi(t), t.flags |= 128, null;
          a = io(
            e,
            t,
            n,
            !1
          );
          var o = t.child.childLanes;
          return a || (n & o) !== 0 ? Ph(e, t, n) : (Oi(t), e = ti(
            e,
            t,
            n
          ), e !== null ? e.sibling : null);
        }
        Oi(t);
        break;
      case 19:
        if (t.flags & 128)
          return rd(
            e,
            t,
            n
          );
        if (o = (e.flags & 128) !== 0, a = (n & t.childLanes) !== 0, a || (io(
          e,
          t,
          n,
          !1
        ), a = (n & t.childLanes) !== 0), o) {
          if (a)
            return rd(
              e,
              t,
              n
            );
          t.flags |= 128;
        }
        if (o = t.memoizedState, o !== null && (o.rendering = null, o.tail = null, o.lastEffect = null), kr(t, Qn.current), a) break;
        return null;
      case 22:
        return t.lanes = 0, qh(
          e,
          t,
          n,
          t.pendingProps
        );
      case 24:
        Si(t, xn, e.memoizedState.cache);
    }
    return ti(e, t, n);
  }
  function Jh(e, t, n) {
    if (e !== null)
      if (e.memoizedProps !== t.pendingProps)
        En = !0;
      else {
        if (!ud(e, n) && (t.flags & 128) === 0)
          return En = !1, Hx(
            e,
            t,
            n
          );
        En = (e.flags & 131072) !== 0;
      }
    else
      En = !1, st && (t.flags & 1048576) !== 0 && wg(t, Hr, t.index);
    switch (t.lanes = 0, t.tag) {
      case 16:
        e: {
          var a = t.pendingProps;
          if (e = so(t.elementType), t.type = e, typeof e == "function")
            hf(e) ? (a = go(e, a), t.tag = 1, t = Xh(
              null,
              t,
              e,
              a,
              n
            )) : (t.tag = 0, t = td(
              null,
              t,
              e,
              a,
              n
            ));
          else {
            if (e != null) {
              var o = e.$$typeof;
              if (o === k) {
                t.tag = 11, t = Vh(
                  null,
                  t,
                  e,
                  a,
                  n
                );
                break e;
              } else if (o === J) {
                t.tag = 14, t = Lh(
                  null,
                  t,
                  e,
                  a,
                  n
                );
                break e;
              } else if (o === le) {
                t.tag = 10, t.type = e, t = Fh(
                  null,
                  t,
                  n
                );
                break e;
              }
            }
            throw t = de(e) || e, Error(s(306, t, ""));
          }
        }
        return t;
      case 0:
        return td(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 1:
        return a = t.type, o = go(
          a,
          t.pendingProps
        ), Xh(
          e,
          t,
          a,
          o,
          n
        );
      case 3:
        e: {
          if (je(
            t,
            t.stateNode.containerInfo
          ), e === null) throw Error(s(387));
          a = t.pendingProps;
          var u = t.memoizedState;
          o = u.element, wf(e, t), Yr(t, a, null, n);
          var d = t.memoizedState;
          if (a = d.cache, Si(t, xn, a), a !== u.cache && Ef(
            t,
            [xn],
            n,
            !0
          ), Gr(), a = d.element, u.isDehydrated)
            if (u = {
              element: a,
              isDehydrated: !1,
              cache: d.cache
            }, t.updateQueue.baseState = u, t.memoizedState = u, t.flags & 256) {
              t = Kh(
                e,
                t,
                a,
                n
              );
              break e;
            } else if (a !== o) {
              o = Xl(
                Error(s(424)),
                t
              ), Ur(o), t = Kh(
                e,
                t,
                a,
                n
              );
              break e;
            } else
              for (e = t.stateNode.containerInfo, e.nodeType === 9 ? e = e.body : e = e.nodeName === "HTML" ? e.ownerDocument.body : e, Kt = Fl(e.firstChild), Bn = t, st = !0, yi = null, Ql = !0, n = qg(
                t,
                null,
                a,
                n
              ), t.child = n; n; )
                n.flags = n.flags & -3 | 134221824, n = n.sibling;
          else {
            if (lo(), a === o) {
              t = ti(
                e,
                t,
                n
              );
              break e;
            }
            Dn(e, t, a, n);
          }
          t = t.child;
        }
        return t;
      case 26:
        return Qo(e, t), e === null ? (n = Ev(
          t.type,
          null,
          t.pendingProps,
          null
        )) ? t.memoizedState = n : st || (t.stateNode = tv(
          t.type,
          t.pendingProps,
          re.current,
          t
        )) : t.memoizedState = Ev(
          t.type,
          e.memoizedProps,
          t.pendingProps,
          e.memoizedState
        ), null;
      case 27:
        return ne(t), e === null && st && (a = t.stateNode = bv(
          t.type,
          t.pendingProps,
          re.current
        ), Bn = t, Ql = !0, o = Kt, Ui(t.type) ? (am = o, Kt = Fl(a.firstChild)) : Kt = o), Dn(
          e,
          t,
          t.pendingProps.children,
          n
        ), Qo(e, t), e === null && (t.flags |= 4194304), t.child;
      case 5:
        return e === null && st && ((o = a = Kt) && (a = MS(
          a,
          t.type,
          t.pendingProps,
          Ql
        ), a !== null ? (t.stateNode = a, Bn = t, Kt = Fl(a.firstChild), Ql = !1, o = !0) : o = !1), o || xi(t)), ne(t), o = t.type, u = t.pendingProps, d = e !== null ? e.memoizedProps : null, a = u.children, Zd(o, u) ? a = null : d !== null && Zd(o, d) && (t.flags |= 32), t.memoizedState !== null && (o = Uf(
          e,
          t,
          Rx,
          null,
          null,
          n
        ), dr._currentValue = o), Qo(e, t), Dn(e, t, a, n), t.child;
      case 6:
        return e === null && st && ((e = n = Kt) && (n = NS(
          n,
          t.pendingProps,
          Ql
        ), n !== null ? (t.stateNode = n, Bn = t, Kt = null, e = !0) : e = !1), e || xi(t)), null;
      case 13:
        return Ph(e, t, n);
      case 4:
        return je(
          t,
          t.stateNode.containerInfo
        ), a = t.pendingProps, e === null ? t.child = fo(
          t,
          null,
          a,
          n
        ) : Dn(e, t, a, n), t.child;
      case 11:
        return Vh(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 7:
        return a = t.pendingProps, Qo(e, t), Dn(e, t, a, n), t.child;
      case 8:
        return Dn(
          e,
          t,
          t.pendingProps.children,
          n
        ), t.child;
      case 12:
        return Dn(
          e,
          t,
          t.pendingProps.children,
          n
        ), t.child;
      case 10:
        return Fh(e, t, n);
      case 9:
        return o = t.type._context, a = t.pendingProps.children, oo(t), o = Kn(o), a = a(o), t.flags |= 1, Dn(e, t, a, n), t.child;
      case 14:
        return Lh(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 15:
        return Bh(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 19:
        return rd(e, t, n);
      case 31:
        return _x(e, t, n);
      case 22:
        return qh(
          e,
          t,
          n,
          t.pendingProps
        );
      case 24:
        return oo(t), a = Kn(xn), e === null ? (o = Tf(), o === null && (o = Gt, u = Cf(), o.pooledCache = u, u.refCount++, u !== null && (o.pooledCacheLanes |= n), o = u), t.memoizedState = { parent: a, cache: o }, Of(t), Si(t, xn, o)) : ((e.lanes & n) !== 0 && (wf(e, t), Yr(t, null, null, n), Gr()), o = e.memoizedState, u = t.memoizedState, o.parent !== a ? (o = { parent: a, cache: a }, t.memoizedState = o, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = o), Si(t, xn, a)) : (a = u.cache, Si(t, xn, a), a !== o.cache && Ef(
          t,
          [xn],
          n,
          !0
        ))), Dn(
          e,
          t,
          t.pendingProps.children,
          n
        ), t.child;
      case 30:
        return t.stateNode === null && (t.stateNode = {
          autoName: null,
          paired: null,
          clones: null,
          ref: null
        }), a = t.pendingProps, a.name != null && a.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : st && Gu(t), e !== null && e.memoizedProps.name !== a.name ? t.flags |= 4194816 : Qo(e, t), Dn(e, t, a.children, n), t.child;
      case 29:
        throw t.pendingProps;
    }
    throw Error(s(156, t.tag));
  }
  function ni(e) {
    e.flags |= 4;
  }
  function sd(e, t, n, a, o) {
    var u;
    if ((u = (e.mode & 32) !== 0) && (u = n === null ? Av(t, a) : Av(t, a) && (a.src !== n.src || a.srcSet !== n.srcSet)), u) {
      if (e.flags |= 16777216, (o & 335544128) === o)
        if (e.stateNode.complete) e.flags |= 8192;
        else if (zp()) e.flags |= 8192;
        else
          throw co = Zu, Af;
    } else e.flags &= -16777217;
  }
  function $h(e, t) {
    if (t.type !== "stylesheet" || (t.state.loading & 4) !== 0)
      e.flags &= -16777217;
    else if (e.flags |= 16777216, !Ov(t))
      if (zp()) e.flags |= 8192;
      else
        throw co = Zu, Af;
  }
  function gs(e, t) {
    t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? On() : 536870912, e.lanes |= t, Wo |= t);
  }
  function Zr(e, t) {
    if (!st)
      switch (e.tailMode) {
        case "visible":
          break;
        case "collapsed":
          for (var n = e.tail, a = null; n !== null; )
            n.alternate !== null && (a = n), n = n.sibling;
          a === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : a.sibling = null;
          break;
        default:
          for (t = e.tail, n = null; t !== null; )
            t.alternate !== null && (n = t), t = t.sibling;
          n === null ? e.tail = null : n.sibling = null;
      }
  }
  function Pt(e) {
    var t = e.alternate !== null && e.alternate.child === e.child, n = 0, a = 0;
    if (t)
      for (var o = e.child; o !== null; )
        n |= o.lanes | o.childLanes, a |= o.subtreeFlags & 1206910976, a |= o.flags & 1206910976, o.return = e, o = o.sibling;
    else
      for (o = e.child; o !== null; )
        n |= o.lanes | o.childLanes, a |= o.subtreeFlags, a |= o.flags, o.return = e, o = o.sibling;
    return e.subtreeFlags |= a, e.childLanes = n, t;
  }
  function Ux(e, t, n) {
    var a = t.pendingProps;
    switch (bf(t), t.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return Pt(t), null;
      case 1:
        return Pt(t), null;
      case 3:
        return n = t.stateNode, a = null, e !== null && (a = e.memoizedState.cache), t.memoizedState.cache !== a && (t.flags |= 2048), $a(xn), Pe(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (qo(t) ? ni(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, xf())), Pt(t), null;
      case 26:
        var o = t.type, u = t.memoizedState;
        return e === null ? (ni(t), u !== null ? (Pt(t), $h(t, u)) : (Pt(t), sd(
          t,
          o,
          null,
          a,
          n
        ))) : u ? u !== e.memoizedState ? (ni(t), Pt(t), $h(t, u)) : (Pt(t), t.flags &= -16777217) : (e = e.memoizedProps, e !== a && ni(t), Pt(t), sd(
          t,
          o,
          e,
          a,
          n
        )), null;
      case 27:
        if (ae(t), n = re.current, o = t.type, e !== null && t.stateNode != null)
          e.memoizedProps !== a && ni(t);
        else {
          if (!a) {
            if (t.stateNode === null)
              throw Error(s(166));
            return Pt(t), t.subtreeFlags &= -33554433, null;
          }
          e = Ee.current, qo(t) ? Ng(t) : (e = bv(o, a, n), t.stateNode = e, ni(t));
        }
        return Pt(t), t.subtreeFlags &= -33554433, null;
      case 5:
        if (ae(t), o = t.type, e !== null && t.stateNode != null)
          e.memoizedProps !== a && ni(t);
        else {
          if (!a) {
            if (t.stateNode === null)
              throw Error(s(166));
            return Pt(t), t.subtreeFlags &= -33554433, null;
          }
          if (u = Ee.current, qo(t))
            Ng(t);
          else {
            var d = ou(
              re.current
            );
            switch (u) {
              case 1:
                u = d.createElementNS(
                  "http://www.w3.org/2000/svg",
                  o
                );
                break;
              case 2:
                u = d.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  o
                );
                break;
              default:
                switch (o) {
                  case "svg":
                    u = d.createElementNS(
                      "http://www.w3.org/2000/svg",
                      o
                    );
                    break;
                  case "math":
                    u = d.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      o
                    );
                    break;
                  case "script":
                    u = d.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(
                      u.firstChild
                    );
                    break;
                  case "select":
                    u = typeof a.is == "string" ? d.createElement("select", {
                      is: a.is
                    }) : d.createElement("select"), a.multiple ? u.multiple = !0 : a.size && (u.size = a.size);
                    break;
                  default:
                    u = typeof a.is == "string" ? d.createElement(o, { is: a.is }) : d.createElement(o);
                }
            }
            u[Xt] = t, u[Mn] = a;
            e: for (d = t.child; d !== null; ) {
              if (d.tag === 5 || d.tag === 6)
                u.appendChild(d.stateNode);
              else if (d.tag !== 4 && d.tag !== 27 && d.child !== null) {
                d.child.return = d, d = d.child;
                continue;
              }
              if (d === t) break e;
              for (; d.sibling === null; ) {
                if (d.return === null || d.return === t)
                  break e;
                d = d.return;
              }
              d.sibling.return = d.return, d = d.sibling;
            }
            t.stateNode = u;
            e: switch (Fn(u, o, a), o) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                a = !!a.autoFocus;
                break e;
              case "img":
                a = !0;
                break e;
              default:
                a = !1;
            }
            a && ni(t);
          }
        }
        return Pt(t), t.subtreeFlags &= -33554433, sd(
          t,
          t.type,
          e === null ? null : e.memoizedProps,
          t.pendingProps,
          n
        ), null;
      case 6:
        if (e && t.stateNode != null)
          e.memoizedProps !== a && ni(t);
        else {
          if (typeof a != "string" && t.stateNode === null)
            throw Error(s(166));
          if (e = re.current, qo(t)) {
            if (e = t.stateNode, n = t.memoizedProps, a = null, o = Bn, o !== null)
              switch (o.tag) {
                case 27:
                case 5:
                  a = o.memoizedProps;
              }
            e[Xt] = t, e = !!(e.nodeValue === n || a !== null && a.suppressHydrationWarning === !0 || Jp(e.nodeValue, n)), e || xi(t, !0);
          } else
            e = ou(e).createTextNode(
              a
            ), e[Xt] = t, t.stateNode = e;
        }
        return Pt(t), null;
      case 31:
        if (n = t.memoizedState, e === null || e.memoizedState !== null) {
          if (a = qo(t), n !== null) {
            if (e === null) {
              if (!a) throw Error(s(318));
              if (e = t.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(557));
              e[Xt] = t;
            } else
              lo(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
            Pt(t), e = !1;
          } else
            n = xf(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
          if (!e)
            return t.flags & 256 ? (zl(t), t) : (zl(t), null);
          if ((t.flags & 128) !== 0)
            throw Error(s(558));
        }
        return Pt(t), null;
      case 13:
        if (a = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
          if (o = qo(t), a !== null && a.dehydrated !== null) {
            if (e === null) {
              if (!o) throw Error(s(318));
              if (o = t.memoizedState, o = o !== null ? o.dehydrated : null, !o) throw Error(s(317));
              o[Xt] = t;
            } else
              lo(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
            Pt(t), o = !1;
          } else
            o = xf(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = o), o = !0;
          if (!o)
            return t.flags & 256 ? (zl(t), t) : (zl(t), null);
        }
        return zl(t), (t.flags & 128) !== 0 ? (t.lanes = n, t) : (n = a !== null, e = e !== null && e.memoizedState !== null, n && (a = t.child, o = null, a.alternate !== null && a.alternate.memoizedState !== null && a.alternate.memoizedState.cachePool !== null && (o = a.alternate.memoizedState.cachePool.pool), u = null, a.memoizedState !== null && a.memoizedState.cachePool !== null && (u = a.memoizedState.cachePool.pool), u !== o && (a.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), gs(t, t.updateQueue), Pt(t), null);
      case 4:
        return Pe(), e === null && kd(t.stateNode.containerInfo), t.flags |= 67108864, Pt(t), null;
      case 10:
        return $a(t.type), Pt(t), null;
      case 19:
        if (jf(t), a = t.memoizedState, a === null) return Pt(t), null;
        if (o = (t.flags & 128) !== 0, u = a.rendering, u === null)
          if (o) Zr(a, !1);
          else {
            if (dn !== 0 || e !== null && (e.flags & 128) !== 0)
              for (e = t.child; e !== null; ) {
                if (u = Wu(e), u !== null) {
                  for (t.flags |= 128, Zr(a, !1), e = u.updateQueue, t.updateQueue = e, gs(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null; )
                    Tg(n, e), n = n.sibling;
                  return kr(
                    t,
                    Qn.current & 1 | 2
                  ), st && Fa(t, a.treeForkCount), t.child;
                }
                e = e.sibling;
              }
            a.tail !== null && Zt() > As && (t.flags |= 128, o = !0, Zr(a, !1), t.lanes = 4194304);
          }
        else {
          if (!o)
            if (e = Wu(u), e !== null) {
              if (t.flags |= 128, o = !0, e = e.updateQueue, t.updateQueue = e, gs(t, e), Zr(a, !0), a.tail === null && a.tailMode !== "collapsed" && a.tailMode !== "visible" && !u.alternate && !st)
                return Pt(t), null;
            } else
              2 * Zt() - a.renderingStartTime > As && n !== 536870912 && (t.flags |= 128, o = !0, Zr(a, !1), t.lanes = 4194304);
          a.isBackwards ? (u.sibling = t.child, t.child = u) : (e = a.last, e !== null ? e.sibling = u : t.child = u, a.last = u);
        }
        if (a.tail !== null) {
          e = a.tail;
          e: {
            for (n = e; n !== null; ) {
              if (n.alternate !== null) {
                n = !1;
                break e;
              }
              n = n.sibling;
            }
            n = !0;
          }
          return a.rendering = e, a.tail = e.sibling, a.renderingStartTime = Zt(), e.sibling = null, u = Qn.current, u = o ? u & 1 | 2 : u & 1, a.tailMode === "visible" || a.tailMode === "collapsed" || !n || st ? kr(t, u) : (n = u, Ne(Pn, t), Ne(Qn, n), rl === null && (rl = t)), st && Fa(t, a.treeForkCount), e;
        }
        return Pt(t), null;
      case 22:
      case 23:
        return zl(t), zf(), a = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== a && (t.flags |= 8192) : a && (t.flags |= 8192), a ? (n & 536870912) !== 0 && (t.flags & 128) === 0 && (Pt(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Pt(t), n = t.updateQueue, n !== null && gs(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), a = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), a !== n && (t.flags |= 2048), e !== null && be(uo), null;
      case 24:
        return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), $a(xn), Pt(t), null;
      case 25:
        return null;
      case 30:
        return t.flags |= 33554432, Pt(t), null;
    }
    throw Error(s(156, t.tag));
  }
  function Ix(e, t) {
    switch (bf(t), t.tag) {
      case 1:
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 3:
        return $a(xn), Pe(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
      case 26:
      case 27:
      case 5:
        return ae(t), null;
      case 31:
        if (t.memoizedState !== null) {
          if (zl(t), t.alternate === null)
            throw Error(s(340));
          lo();
        }
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 13:
        if (zl(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
          if (t.alternate === null)
            throw Error(s(340));
          lo();
        }
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 19:
        return jf(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
      case 4:
        return Pe(), null;
      case 10:
        return $a(t.type), null;
      case 22:
      case 23:
        return zl(t), zf(), e !== null && be(uo), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 24:
        return $a(xn), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function Wh(e, t) {
    switch (bf(t), t.tag) {
      case 3:
        $a(xn), Pe();
        break;
      case 26:
      case 27:
      case 5:
        ae(t);
        break;
      case 4:
        Pe();
        break;
      case 31:
        t.memoizedState !== null && zl(t);
        break;
      case 13:
        zl(t);
        break;
      case 19:
        jf(t);
        break;
      case 10:
        $a(t.type);
        break;
      case 22:
      case 23:
        zl(t), zf(), e !== null && be(uo);
        break;
      case 24:
        $a(xn);
    }
  }
  function Fr(e, t) {
    try {
      var n = t.updateQueue, a = n !== null ? n.lastEffect : null;
      if (a !== null) {
        var o = a.next;
        n = o;
        do {
          if ((n.tag & e) === e) {
            a = void 0;
            var u = n.create, d = n.inst;
            a = u(), d.destroy = a;
          }
          n = n.next;
        } while (n !== o);
      }
    } catch (S) {
      It(t, t.return, S);
    }
  }
  function Mi(e, t, n) {
    try {
      var a = t.updateQueue, o = a !== null ? a.lastEffect : null;
      if (o !== null) {
        var u = o.next;
        a = u;
        do {
          if ((a.tag & e) === e) {
            var d = a.inst, S = d.destroy;
            if (S !== void 0) {
              d.destroy = void 0, o = t;
              var D = n, K = S;
              try {
                K();
              } catch (ee) {
                It(
                  o,
                  D,
                  ee
                );
              }
            }
          }
          a = a.next;
        } while (a !== u);
      }
    } catch (ee) {
      It(t, t.return, ee);
    }
  }
  function ep(e) {
    var t = e.updateQueue;
    if (t !== null) {
      var n = e.stateNode;
      try {
        Yg(t, n);
      } catch (a) {
        It(e, e.return, a);
      }
    }
  }
  function tp(e, t, n) {
    n.props = go(
      e.type,
      e.memoizedProps
    ), n.state = e.memoizedState;
    try {
      n.componentWillUnmount();
    } catch (a) {
      It(e, t, a);
    }
  }
  function Sa(e, t) {
    try {
      var n = e.ref;
      if (n !== null) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            var a = e.stateNode;
            break;
          case 30:
            var o = e.stateNode, u = Pa(e.memoizedProps, o);
            (o.ref === null || o.ref.name !== u) && (o.ref = uv(u)), a = o.ref;
            break;
          case 7:
            if (e.stateNode === null) {
              var d = new Il(e);
              g(
                e.child,
                !1,
                OS,
                d,
                void 0,
                void 0
              ), e.stateNode = d;
            }
            a = e.stateNode;
            break;
          default:
            a = e.stateNode;
        }
        typeof n == "function" ? e.refCleanup = n(a) : n.current = a;
      }
    } catch (S) {
      It(e, t, S);
    }
  }
  function Zn(e, t) {
    var n = e.ref, a = e.refCleanup;
    if (n !== null)
      if (typeof a == "function")
        try {
          a();
        } catch (o) {
          It(e, t, o);
        } finally {
          e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
        }
      else if (typeof n == "function")
        try {
          n(null);
        } catch (o) {
          It(e, t, o);
        }
      else n.current = null;
  }
  function hs(e, t) {
    if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null)
      for (var n = 0; n < t.length; n++)
        gv(
          e.stateNode,
          t[n]
        );
  }
  function np(e) {
    for (var t = e.return; t !== null && (fd(t) && gv(e.stateNode, t.stateNode), !cd(t)); )
      t = t.return;
  }
  function Jr(e) {
    for (var t = e.return; t !== null && (fd(t) && wS(e.stateNode, t.stateNode), !cd(t)); )
      t = t.return;
  }
  function cd(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 27;
  }
  function fd(e) {
    return e && e.tag === 7 && e.stateNode !== null;
  }
  function dd(e) {
    var t = e.type, n = e.memoizedProps, a = e.stateNode;
    try {
      e: switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          n.autoFocus && a.focus();
          break e;
        case "img":
          n.src ? a.src = n.src : n.srcSet && (a.srcset = n.srcSet);
      }
    } catch (o) {
      It(e, e.return, o);
    }
  }
  function md(e, t, n) {
    try {
      var a = e.stateNode;
      sS(a, e.type, n, t), a[Mn] = t;
    } catch (o) {
      It(e, e.return, o);
    }
  }
  function lp(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Ui(e.type) || e.tag === 4;
  }
  function gd(e) {
    e: for (; ; ) {
      for (; e.sibling === null; ) {
        if (e.return === null || lp(e.return)) return null;
        e = e.return;
      }
      for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
        if (e.tag === 27 && Ui(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
        e.child.return = e, e = e.child;
      }
      if (!(e.flags & 2)) return e.stateNode;
    }
  }
  function hd(e, t, n, a) {
    var o = e.tag;
    if (o === 5 || o === 6)
      o = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(o, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(o), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = In)), hs(e, a), Xe = !0;
    else if (o !== 4 && (o === 27 && (hs(e, a), a = null, Ui(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null))
      for (hd(
        e,
        t,
        n,
        a
      ), e = e.sibling; e !== null; )
        hd(
          e,
          t,
          n,
          a
        ), e = e.sibling;
  }
  function ps(e, t, n, a) {
    var o = e.tag;
    if (o === 5 || o === 6)
      o = e.stateNode, t ? n.insertBefore(o, t) : n.appendChild(o), hs(e, a), Xe = !0;
    else if (o !== 4 && (o === 27 && (hs(e, a), a = null, Ui(e.type) && (n = e.stateNode)), e = e.child, e !== null))
      for (ps(
        e,
        t,
        n,
        a
      ), e = e.sibling; e !== null; )
        ps(
          e,
          t,
          n,
          a
        ), e = e.sibling;
  }
  function ap(e) {
    var t = e.stateNode, n = e.memoizedProps;
    try {
      for (var a = e.type, o = t.attributes; o.length; )
        t.removeAttributeNode(o[0]);
      Fn(t, a, n), t[Xt] = e, t[Mn] = n;
    } catch (u) {
      It(e, e.return, u);
    }
  }
  var vs = !1, _l = null;
  function ip(e) {
    (e.tag === 30 || (e.subtreeFlags & 33554432) !== 0) && (vs = !0);
  }
  var Ea = null;
  function op() {
    var e = Ea;
    return Ea = null, e;
  }
  var Cl = 0;
  function Zo(e, t, n, a, o) {
    return Cl = 0, rp(
      e.child,
      t,
      n,
      a,
      o
    );
  }
  function rp(e, t, n, a, o) {
    for (var u = !1; e !== null; ) {
      if (e.tag === 5) {
        var d = e.stateNode;
        if (a !== null) {
          var S = $d(d);
          a.push(S), S.view && (u = !0);
        } else
          u || $d(d).view && (u = !0);
        vs = !0, ov(
          d,
          Cl === 0 ? t : t + "_" + Cl,
          n
        ), Cl++;
      } else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && o || rp(
        e.child,
        t,
        n,
        a,
        o
      ) && (u = !0));
      e = e.sibling;
    }
    return u;
  }
  function Ca(e, t) {
    for (; e !== null; )
      e.tag === 5 ? rv(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || Ca(
        e.child,
        t
      )), e = e.sibling;
  }
  function bs(e) {
    if ((e.subtreeFlags & 18874368) !== 0)
      for (e = e.child; e !== null; ) {
        if ((e.tag !== 22 || e.memoizedState === null) && (bs(e), e.tag === 30 && (e.flags & 18874368) !== 0 && e.stateNode.paired)) {
          var t = e.memoizedProps;
          if (t.name == null || t.name === "auto")
            throw Error(s(544));
          var n = t.name;
          t = Qa(t.default, t.share), t !== "none" && (Zo(
            e,
            n,
            t,
            null,
            !1
          ) || Ca(e.child, !1));
        }
        e = e.sibling;
      }
  }
  function pd(e, t) {
    if (e.tag === 30) {
      var n = e.stateNode, a = e.memoizedProps, o = Pa(a, n), u = Qa(
        a.default,
        n.paired ? a.share : a.enter
      );
      u !== "none" ? Zo(e, o, u, null, !1) ? (bs(e), n.paired || t || lr(e, a.onEnter)) : Ca(e.child, !1) : bs(e);
    } else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; )
        pd(e, t), e = e.sibling;
    else bs(e);
  }
  function vd(e) {
    if (_l !== null && _l.size !== 0) {
      var t = _l;
      if ((e.subtreeFlags & 18874368) !== 0)
        for (e = e.child; e !== null; ) {
          if (e.tag !== 22 || e.memoizedState === null) {
            if (e.tag === 30 && (e.flags & 18874368) !== 0) {
              var n = e.memoizedProps, a = n.name;
              if (a != null && a !== "auto") {
                var o = t.get(a);
                if (o !== void 0) {
                  var u = Qa(
                    n.default,
                    n.share
                  );
                  if (u !== "none" && (Zo(
                    e,
                    a,
                    u,
                    null,
                    !1
                  ) ? (u = e.stateNode, o.paired = u, u.paired = o, lr(e, n.onShare)) : Ca(e.child, !1)), t.delete(a), t.size === 0) break;
                }
              }
            }
            vd(e);
          }
          e = e.sibling;
        }
    }
  }
  function bd(e) {
    if (e.tag === 30) {
      var t = e.memoizedProps, n = Pa(t, e.stateNode), a = _l !== null ? _l.get(n) : void 0, o = Qa(
        t.default,
        a !== void 0 ? t.share : t.exit
      );
      o !== "none" && (Zo(e, n, o, null, !1) ? a !== void 0 ? (o = e.stateNode, a.paired = o, o.paired = a, _l.delete(n), lr(e, t.onShare)) : lr(e, t.onExit) : Ca(e.child, !1)), _l !== null && vd(e);
    } else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; )
        bd(e), e = e.sibling;
    else
      _l !== null && vd(e);
  }
  function up(e) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var t = e.memoizedProps, n = Pa(t, e.stateNode);
        t = Qa(t.default, t.update), e.flags &= -5, t !== "none" && Zo(
          e,
          n,
          t,
          e.memoizedState = [],
          !1
        );
      } else
        (e.subtreeFlags & 33554432) !== 0 && up(e);
      e = e.sibling;
    }
  }
  function yd(e) {
    if ((e.subtreeFlags & 18874368) !== 0)
      for (e = e.child; e !== null; ) {
        if (e.tag !== 22 || e.memoizedState === null) {
          if (e.tag === 30 && (e.flags & 18874368) !== 0) {
            var t = e.stateNode;
            t.paired !== null && (t.paired = null, Ca(e.child, !1));
          }
          yd(e);
        }
        e = e.sibling;
      }
  }
  function ys(e) {
    if (e.tag === 30)
      e.stateNode.paired = null, Ca(e.child, !1), yd(e);
    else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; )
        ys(e), e = e.sibling;
    else yd(e);
  }
  function sp(e) {
    for (e = e.child; e !== null; )
      e.tag === 30 ? Ca(e.child, !1) : (e.subtreeFlags & 33554432) !== 0 && sp(e), e = e.sibling;
  }
  function xd(e, t, n, a, o, u, d) {
    for (var S = !1; t !== null; ) {
      if (t.tag === 5) {
        var D = t.stateNode;
        if (u !== null && Cl < u.length) {
          var K = u[Cl], ee = $d(D);
          (K.view || ee.view) && (S = !0);
          var se;
          if (se = (e.flags & 4) === 0)
            if (ee.clip) se = !0;
            else {
              se = K.rect;
              var Y = ee.rect;
              se = se.y !== Y.y || se.x !== Y.x || se.height !== Y.height || se.width !== Y.width;
            }
          se && (e.flags |= 4), ee.abs ? ee = !K.abs : (K = K.rect, ee = ee.rect, ee = K.height !== ee.height || K.width !== ee.width), ee && (e.flags |= 32);
        } else e.flags |= 32;
        (e.flags & 4) !== 0 && ov(
          D,
          Cl === 0 ? n : n + "_" + Cl,
          o
        ), S && (e.flags & 4) !== 0 || (Ea === null && (Ea = []), Ea.push(
          D,
          Cl === 0 ? a : a + "_" + Cl,
          t.memoizedProps
        )), Cl++;
      } else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && d ? e.flags |= t.flags & 32 : xd(
        e,
        t.child,
        n,
        a,
        o,
        u,
        d
      ) && (S = !0));
      t = t.sibling;
    }
    return S;
  }
  function cp(e, t) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var n = e.memoizedProps, a = e.stateNode, o = Pa(n, a), u = Qa(n.default, n.update), d;
        d = e.memoizedState, e.memoizedState = null, a = e;
        var S = e.child;
        Cl = 0, o = xd(
          a,
          S,
          o,
          o,
          u,
          d,
          !1
        ), (e.flags & 4) !== 0 && o && lr(e, n.onUpdate);
      } else
        (e.subtreeFlags & 33554432) !== 0 && cp(e);
      e = e.sibling;
    }
  }
  var qn = !1, _t = !1, Ra = !1, Sd = !1, fp = typeof WeakSet == "function" ? WeakSet : Set, Gn = null, Ta = !1, $r = !1, xs = !1, Ed = !1;
  function Vx(e, t, n) {
    if (e = e.containerInfo, Pd = mr, e = hg(e), uf(e)) {
      if ("selectionStart" in e)
        var a = {
          start: e.selectionStart,
          end: e.selectionEnd
        };
      else
        e: {
          a = (a = e.ownerDocument) && a.defaultView || window;
          var o = a.getSelection && a.getSelection();
          if (o && o.rangeCount !== 0) {
            a = o.anchorNode;
            var u = o.anchorOffset, d = o.focusNode;
            o = o.focusOffset;
            try {
              a.nodeType, d.nodeType;
            } catch {
              a = null;
              break e;
            }
            var S = 0, D = -1, K = -1, ee = 0, se = 0, Y = e, F = null;
            t: for (; ; ) {
              for (var we; Y !== a || u !== 0 && Y.nodeType !== 3 || (D = S + u), Y !== d || o !== 0 && Y.nodeType !== 3 || (K = S + o), Y.nodeType === 3 && (S += Y.nodeValue.length), (we = Y.firstChild) !== null; )
                F = Y, Y = we;
              for (; ; ) {
                if (Y === e) break t;
                if (F === a && ++ee === u && (D = S), F === d && ++se === o && (K = S), (we = Y.nextSibling) !== null) break;
                Y = F, F = Y.parentNode;
              }
              Y = we;
            }
            a = D === -1 || K === -1 ? null : { start: D, end: K };
          } else a = null;
        }
      a = a || { start: 0, end: 0 };
    } else a = null;
    for (Qd = { focusedElem: e, selectionRange: a }, mr = !1, n = (n & 335544064) === n, Gn = t, t = n ? 9270 : 1024; Gn !== null; ) {
      if (e = Gn, n && (a = e.deletions, a !== null))
        for (u = 0; u < a.length; u++)
          n && bd(a[u]);
      if (e.alternate === null && (e.flags & 2) !== 0)
        n && ip(e), Ss(n);
      else {
        if (e.tag === 22) {
          if (a = e.alternate, e.memoizedState !== null) {
            a !== null && a.memoizedState === null && n && bd(a), Ss(n);
            continue;
          } else if (a !== null && a.memoizedState !== null) {
            n && ip(e), Ss(n);
            continue;
          }
        }
        a = e.child, (e.subtreeFlags & t) !== 0 && a !== null ? (a.return = e, Gn = a) : (n && up(e), Ss(n));
      }
    }
    _l = null;
  }
  function Ss(e) {
    for (; Gn !== null; ) {
      var t = Gn, n = e, a = t.alternate, o = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if ((o & 1024) !== 0 && a !== null) {
            n = void 0, o = a.memoizedProps, a = a.memoizedState;
            var u = t.stateNode;
            try {
              var d = go(
                t.type,
                o
              );
              n = u.getSnapshotBeforeUpdate(
                d,
                a
              ), u.__reactInternalSnapshotBeforeUpdate = n;
            } catch (S) {
              It(t, t.return, S);
            }
          }
          break;
        case 3:
          if ((o & 1024) !== 0) {
            if (a = t.stateNode.containerInfo, n = a.nodeType, n === 9)
              tm(a);
            else if (n === 1)
              switch (a.nodeName) {
                case "HEAD":
                case "HTML":
                case "BODY":
                  tm(a);
                  break;
                default:
                  a.textContent = "";
              }
          }
          break;
        case 5:
        case 26:
        case 27:
        case 6:
        case 4:
        case 17:
          break;
        case 30:
          n && a !== null && (n = Pa(
            a.memoizedProps,
            a.stateNode
          ), o = t.memoizedProps, o = Qa(o.default, o.update), o !== "none" && Zo(
            a,
            n,
            o,
            a.memoizedState = [],
            !0
          ));
          break;
        default:
          if ((o & 1024) !== 0) throw Error(s(163));
      }
      if (a = t.sibling, a !== null) {
        a.return = t.return, Gn = a;
        break;
      }
      Gn = t.return;
    }
  }
  function dp(e, t, n) {
    var a = n.flags;
    switch (n.tag) {
      case 0:
      case 11:
      case 15:
        Aa(e, n), a & 4 && Fr(5, n);
        break;
      case 1:
        if (Aa(e, n), a & 4)
          if (e = n.stateNode, t === null)
            try {
              e.componentDidMount();
            } catch (d) {
              It(n, n.return, d);
            }
          else {
            var o = go(
              n.type,
              t.memoizedProps
            );
            t = t.memoizedState;
            try {
              e.componentDidUpdate(
                o,
                t,
                e.__reactInternalSnapshotBeforeUpdate
              );
            } catch (d) {
              It(
                n,
                n.return,
                d
              );
            }
          }
        a & 64 && ep(n), a & 512 && Sa(n, n.return);
        break;
      case 3:
        if (Aa(e, n), a & 64 && (e = n.updateQueue, e !== null)) {
          if (t = null, n.child !== null)
            switch (n.child.tag) {
              case 27:
              case 5:
                t = n.child.stateNode;
                break;
              case 1:
                t = n.child.stateNode;
            }
          try {
            Yg(e, t);
          } catch (d) {
            It(n, n.return, d);
          }
        }
        break;
      case 27:
        t === null && a & 4 && ap(n);
      case 26:
      case 5:
        Aa(e, n), t === null && a & 4 && dd(n), a & 512 && Sa(n, n.return);
        break;
      case 12:
        Aa(e, n);
        break;
      case 31:
        Aa(e, n), a & 4 && pp(e, n);
        break;
      case 13:
        Aa(e, n), a & 4 && vp(e, n), a & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = Fx.bind(
          null,
          n
        ), DS(e, n))));
        break;
      case 22:
        if (a = n.memoizedState !== null || qn, !a) {
          var u = t !== null && t.memoizedState !== null || _t;
          t = qn, o = _t, qn = a, (_t = u) && !o ? (a = 2, (n.subtreeFlags & 8772) !== 0 && (a |= 1), sa(
            e,
            n,
            a
          )) : Aa(e, n), qn = t, _t = o;
        }
        break;
      case 30:
        Aa(e, n), a & 512 && Sa(n, n.return);
        break;
      case 7:
        a & 512 && Sa(n, n.return);
      default:
        Aa(e, n);
    }
  }
  function Cd(e, t) {
    for (e = e.child; e !== null; )
      mp(e, t), e = e.sibling;
  }
  function mp(e, t) {
    switch (e.tag) {
      case 5:
      case 26:
        try {
          var n = e.stateNode;
          if (t) {
            var a = n.style;
            typeof a.setProperty == "function" ? a.setProperty("display", "none", "important") : a.display = "none";
          } else {
            var o = e.stateNode, u = e.memoizedProps.style, d = u != null && u.hasOwnProperty("display") ? u.display : null;
            o.style.display = d == null || typeof d == "boolean" ? "" : ("" + d).trim();
          }
        } catch (D) {
          It(e, e.return, D);
        }
        Rd(e, t);
        break;
      case 6:
        try {
          e.stateNode.nodeValue = t ? "" : e.memoizedProps, Xe = !0;
        } catch (D) {
          It(e, e.return, D);
        }
        break;
      case 18:
        try {
          var S = e.stateNode;
          t ? iv(S, !0) : iv(e.stateNode, !1);
        } catch (D) {
          It(e, e.return, D);
        }
        break;
      case 22:
      case 23:
        e.memoizedState === null && Cd(e, t);
        break;
      default:
        Cd(e, t);
    }
  }
  function Rd(e, t) {
    if (e.subtreeFlags & 67108864)
      for (e = e.child; e !== null; ) {
        e: {
          var n = e, a = t;
          switch (n.tag) {
            case 4:
              mp(n, a);
              break e;
            case 22:
              n.memoizedState === null && Rd(n, a);
              break e;
            default:
              Rd(n, a);
          }
        }
        e = e.sibling;
      }
  }
  function gp(e) {
    var t = e.alternate;
    t !== null && (e.alternate = null, gp(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && hi(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
  }
  var Wt = null, Rl = !1;
  function ra(e, t, n) {
    for (n = n.child; n !== null; )
      hp(e, t, n), n = n.sibling;
  }
  function hp(e, t, n) {
    if (dt && typeof dt.onCommitFiberUnmount == "function")
      try {
        dt.onCommitFiberUnmount(Ot, n);
      } catch {
      }
    switch (n.tag) {
      case 26:
        _t || Zn(n, t), ra(
          e,
          t,
          n
        ), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !_t && (n = n.stateNode, n.parentNode.removeChild(n));
        break;
      case 27:
        _t || Zn(n, t), Jr(n);
        var a = Wt, o = Rl;
        Ui(n.type) && (Wt = n.stateNode, Rl = !1), ra(
          e,
          t,
          n
        ), yv(
          n.stateNode,
          n.type,
          n.memoizedProps
        ), Wt = a, Rl = o;
        break;
      case 5:
        _t || Zn(n, t), Jr(n);
      case 6:
        if (n.tag === 6 && Jr(n), a = Wt, o = Rl, Wt = null, ra(
          e,
          t,
          n
        ), Wt = a, Rl = o, Wt !== null)
          if (Rl)
            try {
              (Wt.nodeType === 9 ? Wt.body : Wt.nodeName === "HTML" ? Wt.ownerDocument.body : Wt).removeChild(n.stateNode), Xe = !0;
            } catch (u) {
              It(
                n,
                t,
                u
              );
            }
          else
            try {
              Wt.removeChild(n.stateNode), Xe = !0;
            } catch (u) {
              It(
                n,
                t,
                u
              );
            }
        break;
      case 18:
        Wt !== null && (Rl ? (e = Wt, av(
          e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e,
          n.stateNode
        ), gr(e)) : av(Wt, n.stateNode));
        break;
      case 4:
        a = Wt, o = Rl, Wt = n.stateNode.containerInfo, Rl = !0, ra(
          e,
          t,
          n
        ), Wt = a, Rl = o;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        Mi(2, n, t), _t || Mi(4, n, t), ra(
          e,
          t,
          n
        );
        break;
      case 1:
        _t || (Zn(n, t), a = n.stateNode, typeof a.componentWillUnmount == "function" && tp(
          n,
          t,
          a
        )), ra(
          e,
          t,
          n
        );
        break;
      case 21:
        ra(
          e,
          t,
          n
        );
        break;
      case 22:
        _t = (a = _t) || n.memoizedState !== null, ra(
          e,
          t,
          n
        ), _t = a;
        break;
      case 30:
        Zn(n, t), ra(
          e,
          t,
          n
        );
        break;
      case 7:
        _t || Zn(n, t), ra(
          e,
          t,
          n
        );
        break;
      default:
        ra(
          e,
          t,
          n
        );
    }
  }
  function pp(e, t) {
    if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
      e = e.dehydrated;
      try {
        gr(e);
      } catch (n) {
        It(t, t.return, n);
      }
    }
  }
  function vp(e, t) {
    if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
      try {
        gr(e);
      } catch (n) {
        It(t, t.return, n);
      }
  }
  function Lx(e) {
    switch (e.tag) {
      case 31:
      case 13:
      case 19:
        var t = e.stateNode;
        return t === null && (t = e.stateNode = new fp()), t;
      case 22:
        return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new fp()), t;
      default:
        throw Error(s(435, e.tag));
    }
  }
  function Es(e, t) {
    var n = Lx(e);
    t.forEach(function(a) {
      if (!n.has(a)) {
        n.add(a);
        var o = Jx.bind(null, e, a);
        a.then(o, o);
      }
    });
  }
  function pl(e, t, n) {
    var a = t.deletions;
    if (a !== null)
      for (var o = 0; o < a.length; o++) {
        var u = a[o], d = e, S = t, D = S;
        e: for (; D !== null; ) {
          switch (D.tag) {
            case 27:
              if (Ui(D.type)) {
                Wt = D.stateNode, Rl = !1;
                break e;
              }
              break;
            case 5:
              Wt = D.stateNode, Rl = !1;
              break e;
            case 3:
            case 4:
              Wt = D.stateNode.containerInfo, Rl = !0;
              break e;
          }
          D = D.return;
        }
        if (Wt === null) throw Error(s(160));
        hp(d, S, u), Wt = null, Rl = !1, d = u.alternate, d !== null && (d.return = null), u.return = null;
      }
    if (t.subtreeFlags & 13886)
      for (t = t.child; t !== null; )
        bp(t, e, n), t = t.sibling;
  }
  var ua = null;
  function bp(e, t, n) {
    var a = e.alternate, o = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (o & 4 && (a = e.updateQueue, a = a !== null ? a.events : null, a !== null))
          for (var u = 0; u < a.length; u++) {
            var d = a[u];
            d.ref.impl = d.nextImpl;
          }
        pl(t, e, n), vl(e), o & 4 && (Mi(3, e, e.return), Fr(3, e), Mi(5, e, e.return));
        break;
      case 1:
        pl(t, e, n), vl(e), o & 512 && (_t || a === null || Zn(a, a.return)), o & 64 && qn && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
        break;
      case 26:
        if (u = ua, pl(t, e, n), vl(e), o & 512 && (_t || a === null || Zn(a, a.return)), o & 4)
          if (o = a !== null ? a.memoizedState : null, n = e.memoizedState, a === null)
            if (n === null)
              if (e.stateNode === null)
                if (qn)
                  e.stateNode = tv(
                    e.type,
                    e.memoizedProps,
                    t.containerInfo,
                    e
                  );
                else {
                  e: {
                    t = e.type, n = e.memoizedProps, o = u.ownerDocument || u;
                    t: switch (t) {
                      case "title":
                        a = o.getElementsByTagName("title")[0], (!a || a[Ft] || a[Xt] || a.namespaceURI === "http://www.w3.org/2000/svg" || a.hasAttribute("itemprop")) && (a = o.createElement(t), o.head.insertBefore(
                          a,
                          o.querySelector("head > title")
                        )), Fn(a, t, n), a[Xt] = e, me(a), t = a;
                        break e;
                      case "link":
                        if (u = Tv(
                          "link",
                          "href",
                          o
                        ).get(t + (n.href || ""))) {
                          for (d = 0; d < u.length; d++)
                            if (a = u[d], a.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && a.getAttribute("rel") === (n.rel == null ? null : n.rel) && a.getAttribute("title") === (n.title == null ? null : n.title) && a.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
                              u.splice(d, 1);
                              break t;
                            }
                        }
                        a = o.createElement(t), Fn(a, t, n), o.head.appendChild(a);
                        break;
                      case "meta":
                        if (u = Tv(
                          "meta",
                          "content",
                          o
                        ).get(t + (n.content || ""))) {
                          for (d = 0; d < u.length; d++)
                            if (a = u[d], a.getAttribute("content") === (n.content == null ? null : "" + n.content) && a.getAttribute("name") === (n.name == null ? null : n.name) && a.getAttribute("property") === (n.property == null ? null : n.property) && a.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && a.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
                              u.splice(d, 1);
                              break t;
                            }
                        }
                        a = o.createElement(t), Fn(a, t, n), o.head.appendChild(a);
                        break;
                      default:
                        throw Error(s(468, t));
                    }
                    a[Xt] = e, me(a), t = a;
                  }
                  e.stateNode = t;
                }
              else
                qn || um(u, e.type, e.stateNode);
            else
              e.stateNode = Rv(
                u,
                n,
                e.memoizedProps
              );
          else
            o !== n ? (o === null ? (t = a.stateNode, t === null || _t || t.parentNode.removeChild(t)) : o.count--, n === null ? qn || um(u, e.type, e.stateNode) : Rv(u, n, e.memoizedProps)) : n === null && e.stateNode !== null && md(
              e,
              e.memoizedProps,
              a.memoizedProps
            );
        break;
      case 27:
        pl(t, e, n), vl(e), o & 512 && (_t || a === null || Zn(a, a.return)), a !== null && o & 4 && md(
          e,
          e.memoizedProps,
          a.memoizedProps
        );
        break;
      case 5:
        if (u = Ra, Ra = !1, pl(t, e, n), Ra = u, vl(e), o & 512 && (_t || a === null || Zn(a, a.return)), e.flags & 32) {
          t = e.stateNode;
          try {
            pn(t, ""), Xe = !0;
          } catch (ee) {
            It(e, e.return, ee);
          }
        }
        o & 4 && e.stateNode != null && (t = e.memoizedProps, md(
          e,
          t,
          a !== null ? a.memoizedProps : t
        )), o & 1024 && (Sd = !0);
        break;
      case 6:
        if (pl(t, e, n), vl(e), o & 4) {
          if (e.stateNode === null)
            throw Error(s(162));
          t = e.memoizedProps, n = e.stateNode;
          try {
            n.nodeValue = t, Xe = !0;
          } catch (ee) {
            It(e, e.return, ee);
          }
        }
        break;
      case 3:
        if (Xe = !1, Is = null, u = ua, ua = ru(t.containerInfo), pl(t, e, n), ua = u, vl(e), o & 4 && a !== null && a.memoizedState.isDehydrated)
          try {
            gr(t.containerInfo);
          } catch (ee) {
            It(e, e.return, ee);
          }
        Sd && (Sd = !1, yp(e)), Xe = !1;
        break;
      case 4:
        o = Ra, Ra = qn, a = gn(), u = ua, ua = ru(
          e.stateNode.containerInfo
        ), pl(t, e, n), vl(e), ua = u, Xe && $r && (xs = !0), Xe = a, Ra = o;
        break;
      case 12:
        pl(t, e, n), vl(e);
        break;
      case 31:
        pl(t, e, n), vl(e), o & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Es(e, t)));
        break;
      case 13:
        pl(t, e, n), vl(e), e.child.flags & 8192 && e.memoizedState !== null != (a !== null && a.memoizedState !== null) && (Ts = Zt()), o & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Es(e, t)));
        break;
      case 22:
        u = e.memoizedState !== null, d = a !== null && a.memoizedState !== null;
        var S = qn, D = _t, K = Ra;
        qn = S || u, Ra = K || u, _t = D || d, pl(t, e, n), _t = D, Ra = K, qn = S, vl(e), o & 8192 && (t = e.stateNode, t._visibility = u ? t._visibility & -2 : t._visibility | 1, !u || a === null || d || qn || _t || (t = d || _t, n = qn, a = _t, qn = u || qn, _t = t, Ni(e, 2), qn = n, _t = a), !u && Ra || Cd(e, u)), o & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Es(e, n))));
        break;
      case 19:
        pl(t, e, n), vl(e), o & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Es(e, t)));
        break;
      case 30:
        o & 512 && (_t || a === null || Zn(a, a.return)), o = gn(), u = $r, d = (n & 335544064) === n, S = e.memoizedProps, $r = d && Qa(
          S.default,
          S.update
        ) !== "none", pl(t, e, n), vl(e), d && a !== null && Xe && (e.flags |= 4), $r = u, Xe = o;
        break;
      case 21:
        break;
      case 7:
        o & 512 && (_t || a === null || Zn(a, a.return)), a && a.stateNode !== null && (a.stateNode._fragmentFiber = e);
      default:
        pl(t, e, n), vl(e);
    }
  }
  function vl(e) {
    var t = e.flags;
    if (t & 2) {
      try {
        for (var n, a = e.return; a !== null; ) {
          if (lp(a)) {
            n = a;
            break;
          }
          a = a.return;
        }
        a = null;
        for (var o = e.return; o !== null; ) {
          if (fd(o)) {
            var u = o.stateNode;
            a === null ? a = [u] : a.push(u);
          }
          if (cd(o)) break;
          o = o.return;
        }
        var d = a;
        if (n == null) throw Error(s(160));
        switch (n.tag) {
          case 27:
            var S = n.stateNode, D = gd(e);
            ps(
              e,
              D,
              S,
              d
            );
            break;
          case 5:
            var K = n.stateNode;
            n.flags & 32 && (pn(K, ""), n.flags &= -33);
            var ee = gd(e);
            ps(
              e,
              ee,
              K,
              d
            );
            break;
          case 3:
          case 4:
            var se = n.stateNode.containerInfo, Y = gd(e);
            hd(
              e,
              Y,
              se,
              d
            );
            break;
          default:
            throw Error(s(161));
        }
      } catch (F) {
        It(e, e.return, F);
      }
      e.flags &= -3;
    }
    t & 4096 && (e.flags &= -4097);
  }
  function yp(e) {
    if (e.subtreeFlags & 1024)
      for (e = e.child; e !== null; ) {
        var t = e;
        yp(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, mr = !0, t.reset(), mr = !1), e = e.sibling;
      }
  }
  function Fo(e, t) {
    if (t.subtreeFlags & 9270)
      for (t = t.child; t !== null; )
        xp(t, e), t = t.sibling;
    else cp(t);
  }
  function xp(e, t) {
    var n = e.alternate;
    if (n === null) pd(e, !1);
    else
      switch (e.tag) {
        case 3:
          if (Ed = Ta = !1, op(), Fo(t, e), !Ta && !xs) {
            if (e = Ea, e !== null)
              for (var a = 0; a < e.length; a += 3) {
                n = e[a];
                var o = e[a + 1];
                rv(n, e[a + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate(
                  { opacity: [0, 0], pointerEvents: ["none", "none"] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition-group(" + o + ")"
                  }
                );
              }
            e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate(
              { opacity: [0, 0], pointerEvents: ["none", "none"] },
              {
                duration: 0,
                fill: "forwards",
                pseudoElement: "::view-transition-group(root)"
              }
            ), e.animate(
              { width: [0, 0], height: [0, 0] },
              {
                duration: 0,
                fill: "forwards",
                pseudoElement: "::view-transition"
              }
            )), Ed = !0;
          }
          Ea = null;
          break;
        case 5:
          Fo(t, e);
          break;
        case 4:
          a = Ta, Ta = !1, Fo(t, e), Ta && (xs = !0), Ta = a;
          break;
        case 22:
          e.memoizedState === null && (n.memoizedState !== null ? pd(e, !1) : Fo(t, e));
          break;
        case 30:
          a = Ta, o = op(), Ta = !1, Fo(t, e), Ta && (e.flags |= 4);
          var u = e.memoizedProps, d = e.stateNode;
          t = Pa(u, d), d = Pa(n.memoizedProps, d);
          var S = Qa(u.default, u.update);
          S === "none" ? t = !1 : (u = n.memoizedState, n.memoizedState = null, n = e.child, Cl = 0, t = xd(
            e,
            n,
            t,
            d,
            S,
            u,
            !0
          ), Cl !== (u === null ? 0 : u.length) && (e.flags |= 32)), (e.flags & 4) !== 0 && t ? (lr(
            e,
            e.memoizedProps.onUpdate
          ), Ea = o) : o !== null && (o.push.apply(o, Ea), Ea = o), Ta = (e.flags & 32) !== 0 ? !0 : a;
          break;
        default:
          Fo(t, e);
      }
  }
  function Aa(e, t) {
    if (t.subtreeFlags & 8772)
      for (t = t.child; t !== null; )
        dp(e, t.alternate, t), t = t.sibling;
  }
  function Ni(e, t) {
    for (e = e.child; e !== null; ) {
      var n = e, a = t;
      switch (n.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          Mi(4, n, n.return), Ni(
            n,
            a
          );
          break;
        case 1:
          Zn(n, n.return);
          var o = n.stateNode;
          typeof o.componentWillUnmount == "function" && tp(
            n,
            n.return,
            o
          ), Ni(
            n,
            a
          );
          break;
        case 27:
          (a & 2) !== 0 && yv(
            n.stateNode,
            n.type,
            n.memoizedProps
          );
        case 5:
          Zn(n, n.return), n.tag !== 5 && n.tag !== 27 || Jr(n), Ni(
            n,
            a
          );
          break;
        case 6:
          Jr(n);
          break;
        case 26:
          Zn(n, n.return), o = n.stateNode, n.memoizedState !== null || o === null || _t || o.parentNode.removeChild(o), Ni(
            n,
            a
          );
          break;
        case 22:
          n.memoizedState === null && Ni(
            n,
            a
          );
          break;
        case 30:
          Zn(n, n.return), Ni(
            n,
            a
          );
          break;
        case 7:
          Zn(n, n.return);
        default:
          Ni(
            n,
            a
          );
      }
      e = e.sibling;
    }
  }
  function sa(e, t, n) {
    for (n = (t.subtreeFlags & 8772) !== 0 ? n : n & -2, t = t.child; t !== null; ) {
      var a = t.alternate, o = e, u = t, d = u.flags, S = (n & 1) !== 0;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          sa(
            o,
            u,
            n
          ), Fr(4, u);
          break;
        case 1:
          if (sa(
            o,
            u,
            n
          ), a = u, o = a.stateNode, typeof o.componentDidMount == "function")
            try {
              o.componentDidMount();
            } catch (ee) {
              It(a, a.return, ee);
            }
          if (a = u, o = a.updateQueue, o !== null) {
            var D = a.stateNode;
            try {
              var K = o.shared.hiddenCallbacks;
              if (K !== null)
                for (o.shared.hiddenCallbacks = null, o = 0; o < K.length; o++)
                  Gg(K[o], D);
            } catch (ee) {
              It(a, a.return, ee);
            }
          }
          S && d & 64 && ep(u), Sa(u, u.return);
          break;
        case 27:
          (n & 2) !== 0 && ap(u);
        case 5:
          u.tag !== 5 && u.tag !== 27 || np(u), sa(
            o,
            u,
            n
          ), S && a === null && d & 4 && dd(u), Sa(u, u.return);
          break;
        case 6:
          np(u);
          break;
        case 26:
          D = u.stateNode, u.memoizedState !== null || D === null || qn || um(
            ru(D.ownerDocument),
            u.type,
            D
          ), sa(
            o,
            u,
            n
          ), S && a === null && d & 4 && dd(u), Sa(u, u.return);
          break;
        case 12:
          sa(
            o,
            u,
            n
          );
          break;
        case 31:
          sa(
            o,
            u,
            n
          ), S && d & 4 && pp(o, u);
          break;
        case 13:
          sa(
            o,
            u,
            n
          ), S && d & 4 && vp(o, u);
          break;
        case 22:
          u.memoizedState === null && sa(
            o,
            u,
            n
          ), Sa(u, u.return);
          break;
        case 30:
          sa(
            o,
            u,
            n
          ), Sa(u, u.return);
          break;
        case 7:
          Sa(u, u.return);
        default:
          sa(
            o,
            u,
            n
          );
      }
      t = t.sibling;
    }
  }
  function Td(e, t) {
    var n = null;
    e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Ir(n));
  }
  function Ad(e, t) {
    e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Ir(e));
  }
  function Zl(e, t, n, a) {
    var o = (n & 335544064) === n;
    if (t.subtreeFlags & (o ? 10262 : 10256))
      for (t = t.child; t !== null; )
        Sp(
          e,
          t,
          n,
          a
        ), t = t.sibling;
    else o && sp(t);
  }
  function Sp(e, t, n, a) {
    var o = (n & 335544064) === n;
    o && t.alternate === null && t.return !== null && t.return.alternate !== null && ys(t);
    var u = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        Zl(
          e,
          t,
          n,
          a
        ), u & 2048 && Fr(9, t);
        break;
      case 1:
        Zl(
          e,
          t,
          n,
          a
        );
        break;
      case 3:
        Zl(
          e,
          t,
          n,
          a
        ), o && Ed && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), u & 2048 && (u = null, t.alternate !== null && (u = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== u && (t.refCount++, u != null && Ir(u)));
        break;
      case 12:
        if (u & 2048) {
          Zl(
            e,
            t,
            n,
            a
          ), u = t.stateNode;
          try {
            var d = t.memoizedProps, S = d.id, D = d.onPostCommit;
            typeof D == "function" && D(
              S,
              t.alternate === null ? "mount" : "update",
              u.passiveEffectDuration,
              -0
            );
          } catch (K) {
            It(t, t.return, K);
          }
        } else
          Zl(
            e,
            t,
            n,
            a
          );
        break;
      case 31:
        Zl(
          e,
          t,
          n,
          a
        );
        break;
      case 13:
        Zl(
          e,
          t,
          n,
          a
        );
        break;
      case 23:
        break;
      case 22:
        d = t.stateNode, S = t.alternate, t.memoizedState !== null ? (o && S !== null && S.memoizedState === null && ys(S), d._visibility & 2 ? Zl(
          e,
          t,
          n,
          a
        ) : Wr(
          e,
          t
        )) : (o && S !== null && S.memoizedState !== null && ys(t), d._visibility & 2 ? Zl(
          e,
          t,
          n,
          a
        ) : (d._visibility |= 2, Jo(
          e,
          t,
          n,
          a,
          (t.subtreeFlags & 10256) !== 0 || !1
        ))), u & 2048 && Td(S, t);
        break;
      case 24:
        Zl(
          e,
          t,
          n,
          a
        ), u & 2048 && Ad(t.alternate, t);
        break;
      case 30:
        o && (u = t.alternate, u !== null && (Ca(u.child, !0), Ca(t.child, !0))), Zl(
          e,
          t,
          n,
          a
        );
        break;
      default:
        Zl(
          e,
          t,
          n,
          a
        );
    }
  }
  function Jo(e, t, n, a, o) {
    for (o = o && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
      var u = e, d = t, S = n, D = a, K = d.flags;
      switch (d.tag) {
        case 0:
        case 11:
        case 15:
          Jo(
            u,
            d,
            S,
            D,
            o
          ), Fr(8, d);
          break;
        case 23:
          break;
        case 22:
          var ee = d.stateNode;
          d.memoizedState !== null ? ee._visibility & 2 ? Jo(
            u,
            d,
            S,
            D,
            o
          ) : Wr(
            u,
            d
          ) : (ee._visibility |= 2, Jo(
            u,
            d,
            S,
            D,
            o
          )), o && K & 2048 && Td(
            d.alternate,
            d
          );
          break;
        case 24:
          Jo(
            u,
            d,
            S,
            D,
            o
          ), o && K & 2048 && Ad(d.alternate, d);
          break;
        default:
          Jo(
            u,
            d,
            S,
            D,
            o
          );
      }
      t = t.sibling;
    }
  }
  function Wr(e, t) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) {
        var n = e, a = t, o = a.flags;
        switch (a.tag) {
          case 22:
            Wr(n, a), o & 2048 && Td(
              a.alternate,
              a
            );
            break;
          case 24:
            Wr(n, a), o & 2048 && Ad(a.alternate, a);
            break;
          default:
            Wr(n, a);
        }
        t = t.sibling;
      }
  }
  var ho = 8192;
  function po(e, t, n) {
    if (e.subtreeFlags & ho)
      for (e = e.child; e !== null; )
        Ep(
          e,
          t,
          n
        ), e = e.sibling;
  }
  function Ep(e, t, n) {
    switch (e.tag) {
      case 26:
        po(
          e,
          t,
          n
        ), e.flags & ho && (e.memoizedState !== null ? XS(
          n,
          ua,
          e.memoizedState,
          e.memoizedProps
        ) : (e = e.stateNode, (t & 335544128) === t && Mv(n, e)));
        break;
      case 5:
        po(
          e,
          t,
          n
        ), e.flags & ho && (e = e.stateNode, (t & 335544128) === t && Mv(n, e));
        break;
      case 3:
      case 4:
        var a = ua;
        ua = ru(e.stateNode.containerInfo), po(
          e,
          t,
          n
        ), ua = a;
        break;
      case 22:
        e.memoizedState === null && (a = e.alternate, a !== null && a.memoizedState !== null ? (a = ho, ho = 16777216, po(
          e,
          t,
          n
        ), ho = a) : po(
          e,
          t,
          n
        ));
        break;
      case 30:
        if ((e.flags & ho) !== 0 && (a = e.memoizedProps.name, a != null && a !== "auto")) {
          var o = e.stateNode;
          o.paired = null, _l === null && (_l = /* @__PURE__ */ new Map()), _l.set(a, o);
        }
        po(
          e,
          t,
          n
        );
        break;
      default:
        po(
          e,
          t,
          n
        );
    }
  }
  function Cp(e) {
    var t = e.alternate;
    if (t !== null && (e = t.child, e !== null)) {
      t.child = null;
      do
        t = e.sibling, e.sibling = null, e = t;
      while (e !== null);
    }
  }
  function eu(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var n = 0; n < t.length; n++) {
          var a = t[n];
          Gn = a, Tp(
            a,
            e
          );
        }
      Cp(e);
    }
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; )
        Rp(e), e = e.sibling;
  }
  function Rp(e) {
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        eu(e), e.flags & 2048 && Mi(9, e, e.return);
        break;
      case 3:
        eu(e);
        break;
      case 12:
        eu(e);
        break;
      case 22:
        var t = e.stateNode;
        e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Cs(e)) : eu(e);
        break;
      default:
        eu(e);
    }
  }
  function Cs(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var n = 0; n < t.length; n++) {
          var a = t[n];
          Gn = a, Tp(
            a,
            e
          );
        }
      Cp(e);
    }
    for (e = e.child; e !== null; ) {
      switch (t = e, t.tag) {
        case 0:
        case 11:
        case 15:
          Mi(8, t, t.return), Cs(t);
          break;
        case 22:
          n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Cs(t));
          break;
        default:
          Cs(t);
      }
      e = e.sibling;
    }
  }
  function Tp(e, t) {
    for (; Gn !== null; ) {
      var n = Gn;
      switch (n.tag) {
        case 0:
        case 11:
        case 15:
          Mi(8, n, t);
          break;
        case 23:
        case 22:
          if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
            var a = n.memoizedState.cachePool.pool;
            a != null && a.refCount++;
          }
          break;
        case 24:
          Ir(n.memoizedState.cache);
      }
      if (a = n.child, a !== null) a.return = n, Gn = a;
      else
        e: for (n = e; Gn !== null; ) {
          a = Gn;
          var o = a.sibling, u = a.return;
          if (gp(a), a === n) {
            Gn = null;
            break e;
          }
          if (o !== null) {
            o.return = u, Gn = o;
            break e;
          }
          Gn = u;
        }
    }
  }
  var Bx = {
    getCacheForType: function(e) {
      var t = Kn(xn), n = t.data.get(e);
      return n === void 0 && (n = e(), t.data.set(e, n)), n;
    },
    cacheSignal: function() {
      return Kn(xn).controller.signal;
    }
  }, qx = typeof WeakMap == "function" ? WeakMap : Map, Dt = 0, Gt = null, gt = null, yt = 0, Ut = 0, jl = null, Di = !1, $o = !1, Od = !1, li = 0, dn = 0, zi = 0, vo = 0, Rs = 0, Hl = 0, Wo = 0, tu = null, Tl = null, wd = !1, Ts = 0, Ap = 0, As = 1 / 0, Os = null, _i = null, rn = 0, ca = null, bo = null, Oa = 0, Md = 0, Nd = null, Op = null, er = null, tr = null, nr = null, nu = 0, ws = null;
  function Ul() {
    return (Dt & 2) !== 0 && yt !== 0 ? yt & -yt : pe.T !== null ? Bd() : xl();
  }
  function wp() {
    if (Hl === 0)
      if ((yt & 536870912) === 0 || st) {
        var e = An;
        An <<= 1, (An & 3932160) === 0 && (An = 262144), Hl = e;
      } else Hl = 536870912;
    return e = Pn.current, e !== null && (e.flags |= 32), Hl;
  }
  function lr(e, t) {
    if (t != null) {
      var n = e.stateNode, a = n.ref;
      a === null && (a = n.ref = uv(
        Pa(e.memoizedProps, n)
      )), tr === null && (tr = []), tr.push(t.bind(null, a));
    }
  }
  function Al(e, t, n) {
    (e === Gt && (Ut === 2 || Ut === 9) || e.cancelPendingCommit !== null) && (ar(e, 0), ji(
      e,
      yt,
      Hl,
      !1
    )), ll(e, n), ((Dt & 2) === 0 || e !== Gt) && (e === Gt && ((Dt & 2) === 0 && (vo |= n), dn === 4 && ji(
      e,
      yt,
      Hl,
      !1
    )), wa(e));
  }
  function Mp(e, t, n) {
    if ((Dt & 6) !== 0) throw Error(s(327));
    var a = !n && (t & 127) === 0 && (t & e.expiredLanes) === 0 || ml(e, t), o = a ? kx(e, t) : zd(e, t, !0), u = a;
    do {
      if (o === 0) {
        $o && !a && ji(e, t, 0, !1);
        break;
      } else {
        if (n = e.current.alternate, u && !Gx(n)) {
          o = zd(e, t, !1), u = !1;
          continue;
        }
        if (o === 2) {
          if (u = t, e.errorRecoveryDisabledLanes & u)
            var d = 0;
          else
            d = e.pendingLanes & -536870913, d = d !== 0 ? d : d & 536870912 ? 536870912 : 0;
          if (d !== 0) {
            t = d;
            e: {
              var S = e;
              o = tu;
              var D = S.current.memoizedState.isDehydrated;
              if (D && (ar(S, d).flags |= 256), d = zd(
                S,
                d,
                !1
              ), d !== 2 && d !== 6) {
                if (Od && !D) {
                  S.errorRecoveryDisabledLanes |= u, vo |= u, o = 4;
                  break e;
                }
                u = Tl, Tl = o, u !== null && (Tl === null ? Tl = u : Tl.push.apply(
                  Tl,
                  u
                ));
              }
              o = d;
            }
            if (u = !1, o !== 2) continue;
          }
        }
        if (o === 1) {
          ar(e, 0), ji(e, t, 0, !0);
          break;
        }
        e: {
          switch (a = e, u = o, u) {
            case 0:
            case 1:
              throw Error(s(345));
            case 4:
              if ((t & 4194048) !== t && (t & 62914560) !== t)
                break;
            case 6:
              ji(
                a,
                t,
                Hl,
                !Di
              );
              break e;
            case 2:
              Tl = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(s(329));
          }
          if ((t & 62914560) === t && (o = Ts + 300 - Zt(), 10 < o)) {
            if (ji(
              a,
              t,
              Hl,
              !Di
            ), ut(a, 0, !0) !== 0) break e;
            Oa = t, a.timeoutHandle = Jd(
              Np.bind(
                null,
                a,
                n,
                Tl,
                Os,
                wd,
                t,
                Hl,
                vo,
                Wo,
                Di,
                u,
                "Throttled",
                -0,
                0
              ),
              o
            );
            break e;
          }
          Np(
            a,
            n,
            Tl,
            Os,
            wd,
            t,
            Hl,
            vo,
            Wo,
            Di,
            u,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    wa(e);
  }
  function Np(e, t, n, a, o, u, d, S, D, K, ee, se, Y, F) {
    e.timeoutHandle = -1;
    var we = t.subtreeFlags, Ve = (u & 335544064) === u;
    if (se = null, (Ve || we & 8192 || (we & 16785408) === 16785408) && (se = {
      stylesheets: null,
      count: 0,
      imgCount: 0,
      imgBytes: 0,
      suspenseyImages: [],
      waitingForImages: !0,
      waitingForViewTransition: !1,
      unsuspend: In
    }, _l = null, Ep(
      t,
      u,
      se
    ), Ve && (we = se, Ve = e.containerInfo, Ve = (Ve.nodeType === 9 ? Ve : Ve.ownerDocument).__reactViewTransition, Ve != null && (we.count++, we.waitingForViewTransition = !0, we = cu.bind(we), Ve.finished.then(we, we))), we = (u & 62914560) === u ? Ts - Zt() : (u & 4194048) === u ? Ap - Zt() : 0, we = KS(
      se,
      we
    ), we !== null)) {
      Oa = u, e.cancelPendingCommit = we(
        Vp.bind(
          null,
          e,
          t,
          u,
          n,
          a,
          o,
          d,
          S,
          D,
          K,
          ee,
          se,
          null,
          Y,
          F
        )
      ), ji(e, u, d, !K);
      return;
    }
    Vp(
      e,
      t,
      u,
      n,
      a,
      o,
      d,
      S,
      D,
      K,
      ee,
      se
    );
  }
  function Gx(e) {
    for (var t = e; ; ) {
      var n = t.tag;
      if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null)))
        for (var a = 0; a < n.length; a++) {
          var o = n[a], u = o.getSnapshot;
          o = o.value;
          try {
            if (!Dl(u(), o)) return !1;
          } catch {
            return !1;
          }
        }
      if (n = t.child, t.subtreeFlags & 16384 && n !== null)
        n.return = t, t = n;
      else {
        if (t === e) break;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e) return !0;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
    }
    return !0;
  }
  function ji(e, t, n, a) {
    t = Nl(e, t), t &= ~Rs, t &= ~vo, e.suspendedLanes |= t, e.pingedLanes &= ~t, a && (e.warmLanes |= t), a = e.expirationTimes;
    for (var o = t; 0 < o; ) {
      var u = 31 - pt(o), d = 1 << u;
      a[u] = -1, o &= ~d;
    }
    n !== 0 && al(e, n, t);
  }
  function Ms() {
    return (Dt & 6) === 0 ? (lu(0), !1) : !0;
  }
  function Dd() {
    if (gt !== null) {
      if (Ut === 0)
        var e = gt.return;
      else
        e = gt, Ja = ao = null, Lf(e), ko = null, Br = 0, e = gt;
      for (; e !== null; )
        Wh(e.alternate, e), e = e.return;
      gt = null;
    }
  }
  function ar(e, t) {
    var n = e.timeoutHandle;
    return n !== -1 && (e.timeoutHandle = -1, dS(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Oa = 0, Dd(), Gt = e, gt = n = Za(e.current, null), yt = t, Ut = 0, jl = null, Di = !1, $o = ml(e, t), Od = !1, Wo = Hl = Rs = vo = zi = dn = 0, Tl = tu = null, wd = !1, li = Nl(e, t), Iu(), n;
  }
  function Dp(e, t) {
    ot = null, pe.H = us, t === Yo || t === Qu ? (t = Vg(), Ut = 3) : t === Af ? (t = Vg(), Ut = 4) : Ut = t === ed ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, jl = t, gt === null && (dn = 1, ss(
      e,
      Xl(t, e.current)
    ));
  }
  function zp() {
    var e = Pn.current;
    return e === null ? !0 : (yt & 4194048) === yt ? rl === null : (yt & 62914560) === yt || (yt & 536870912) !== 0 ? e === rl : !1;
  }
  function _p() {
    var e = pe.H;
    return pe.H = us, e === null ? us : e;
  }
  function jp() {
    var e = pe.A;
    return pe.A = Bx, e;
  }
  function Ns() {
    dn = 4, Di || (yt & 4194048) !== yt && Pn.current !== null || ($o = !0), (zi & 134217727) === 0 && (vo & 134217727) === 0 || Gt === null || ji(
      Gt,
      yt,
      Hl,
      !1
    );
  }
  function zd(e, t, n) {
    var a = Dt;
    Dt |= 2;
    var o = _p(), u = jp();
    (Gt !== e || yt !== t) && (Os = null, ar(e, t)), t = !1;
    var d = dn;
    e: do
      try {
        if (Ut !== 0 && gt !== null) {
          var S = gt, D = jl;
          switch (Ut) {
            case 8:
              Dd(), d = 6;
              break e;
            case 3:
            case 2:
            case 9:
            case 6:
              Pn.current === null && (t = !0);
              var K = Ut;
              if (Ut = 0, jl = null, ir(e, S, D, K), n && $o) {
                d = 0;
                break e;
              }
              break;
            default:
              K = Ut, Ut = 0, jl = null, ir(e, S, D, K);
          }
        }
        Yx(), d = dn;
        break;
      } catch (ee) {
        Dp(e, ee);
      }
    while (!0);
    return t && e.shellSuspendCounter++, Ja = ao = null, Dt = a, pe.H = o, pe.A = u, gt === null && (Gt = null, yt = 0, Iu()), d;
  }
  function Yx() {
    for (; gt !== null; ) Hp(gt);
  }
  function kx(e, t) {
    var n = Dt;
    Dt |= 2;
    var a = _p(), o = jp();
    Gt !== e || yt !== t ? (Os = null, As = Zt() + 500, ar(e, t)) : $o = ml(
      e,
      t
    );
    e: do
      try {
        if (Ut !== 0 && gt !== null) {
          t = gt;
          var u = jl;
          t: switch (Ut) {
            case 1:
              Ut = 0, jl = null, ir(e, t, u, 1);
              break;
            case 2:
            case 9:
              if (Ug(u)) {
                Ut = 0, jl = null, Up(t);
                break;
              }
              t = function() {
                Ut !== 2 && Ut !== 9 || Gt !== e || (Ut = 7), wa(e);
              }, u.then(t, t);
              break e;
            case 3:
              Ut = 7;
              break e;
            case 4:
              Ut = 5;
              break e;
            case 7:
              Ug(u) ? (Ut = 0, jl = null, Up(t)) : (Ut = 0, jl = null, ir(e, t, u, 7));
              break;
            case 5:
              var d = null;
              switch (gt.tag) {
                case 26:
                  d = gt.memoizedState;
                case 5:
                case 27:
                  var S = gt;
                  if (d ? Ov(d) : S.stateNode.complete) {
                    Ut = 0, jl = null;
                    var D = S.sibling;
                    if (D !== null) gt = D;
                    else {
                      var K = S.return;
                      K !== null ? (gt = K, Ds(K)) : gt = null;
                    }
                    break t;
                  }
              }
              Ut = 0, jl = null, ir(e, t, u, 5);
              break;
            case 6:
              Ut = 0, jl = null, ir(e, t, u, 6);
              break;
            case 8:
              Dd(), dn = 6;
              break e;
            default:
              throw Error(s(462));
          }
        }
        Xx();
        break;
      } catch (ee) {
        Dp(e, ee);
      }
    while (!0);
    return Ja = ao = null, pe.H = a, pe.A = o, Dt = n, gt !== null ? 0 : (Gt = null, yt = 0, Iu(), dn);
  }
  function Xx() {
    for (; gt !== null && !el(); )
      Hp(gt);
  }
  function Hp(e) {
    var t = Jh(e.alternate, e, li);
    e.memoizedProps = e.pendingProps, t === null ? Ds(e) : gt = t;
  }
  function Up(e) {
    var t = e, n = t.alternate;
    switch (t.tag) {
      case 15:
      case 0:
        t = kh(
          n,
          t,
          t.pendingProps,
          t.type,
          void 0,
          yt
        );
        break;
      case 11:
        t = kh(
          n,
          t,
          t.pendingProps,
          t.type.render,
          t.ref,
          yt
        );
        break;
      case 5:
        Lf(t);
        var a = t;
        a === Bn && (st ? (Yu(a), a.tag === 5 && a.stateNode != null && (Kt = a.stateNode)) : (Yu(a), st = !0));
      default:
        Wh(n, t), t = gt = Tg(t, li), t = Jh(n, t, li);
    }
    e.memoizedProps = e.pendingProps, t === null ? Ds(e) : gt = t;
  }
  function ir(e, t, n, a) {
    Ja = ao = null, Lf(t), ko = null, Br = 0;
    var o = t.return;
    try {
      if (zx(
        e,
        o,
        t,
        n,
        yt
      )) {
        dn = 1, ss(
          e,
          Xl(n, e.current)
        ), gt = null;
        return;
      }
    } catch (u) {
      if (o !== null) throw gt = o, u;
      dn = 1, ss(
        e,
        Xl(n, e.current)
      ), gt = null;
      return;
    }
    t.flags & 32768 ? (st || a === 1 ? e = !0 : $o || (yt & 536870912) !== 0 ? e = !1 : (Di = e = !0, (a === 2 || a === 9 || a === 3 || a === 6) && (a = Pn.current, a !== null && a.tag === 13 && (a.flags |= 16384))), Ip(t, e)) : Ds(t);
  }
  function Ds(e) {
    var t = e;
    do {
      if ((t.flags & 32768) !== 0) {
        Ip(
          t,
          Di
        );
        return;
      }
      e = t.return;
      var n = Ux(
        t.alternate,
        t,
        li
      );
      if (n !== null) {
        gt = n;
        return;
      }
      if (t = t.sibling, t !== null) {
        gt = t;
        return;
      }
      gt = t = e;
    } while (t !== null);
    dn === 0 && (dn = 5);
  }
  function Ip(e, t) {
    do {
      var n = Ix(e.alternate, e);
      if (n !== null) {
        n.flags &= 32767, gt = n;
        return;
      }
      if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
        gt = e;
        return;
      }
      gt = e = n;
    } while (e !== null);
    dn = 6, gt = null;
  }
  function Vp(e, t, n, a, o, u, d, S, D, K, ee, se) {
    e.cancelPendingCommit = null;
    do
      zs();
    while (rn !== 0);
    if ((Dt & 6) !== 0) throw Error(s(327));
    if (t !== null) {
      if (t === e.current) throw Error(s(177));
      e === Gt && (gt = Gt = null, yt = 0), bo = t, ca = e, Oa = n, Nd = o, Op = a, Kx(
        e,
        t,
        n,
        d,
        S,
        D,
        se
      );
    }
  }
  function Kx(e, t, n, a, o, u, d) {
    var S = t.lanes | t.childLanes;
    if (Md = S, S |= mf, Va(
      e,
      n,
      S,
      a,
      o,
      u
    ), tr = null, (n & 335544064) === n ? (nr = xx(e), a = 10262) : (nr = null, a = 10256), (t.subtreeFlags & a) !== 0 || (t.flags & a) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, $x(Bt, function() {
      return Ud(), null;
    })) : (e.callbackNode = null, e.callbackPriority = 0), vs = !1, a = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || a) {
      a = pe.T, pe.T = null, o = xe.p, xe.p = 2, u = Dt, Dt |= 4;
      try {
        Vx(e, t, n);
      } finally {
        Dt = u, xe.p = o, pe.T = a;
      }
    }
    rn = 1, vs ? er = bS(
      d,
      e.containerInfo,
      nr,
      _d,
      jd,
      Qx,
      Hd,
      Ud,
      Px
    ) : (_d(), jd(), Hd());
  }
  function Px(e) {
    if (rn !== 0) {
      var t = ca.onRecoverableError;
      t(e, { componentStack: null });
    }
  }
  function Qx() {
    rn === 3 && (rn = 0, xp(bo, ca), rn = 4);
  }
  function _d() {
    if (rn === 1) {
      rn = 0;
      var e = ca, t = bo, n = Oa, a = (t.flags & 13878) !== 0;
      if ((t.subtreeFlags & 13878) !== 0 || a) {
        a = pe.T, pe.T = null;
        var o = xe.p;
        xe.p = 2;
        var u = Dt;
        Dt |= 4;
        try {
          $r = xs = !1, bp(t, e, n), n = Qd;
          var d = hg(e.containerInfo), S = n.focusedElem, D = n.selectionRange;
          if (d !== S && S && S.ownerDocument && gg(
            S.ownerDocument.documentElement,
            S
          )) {
            if (D !== null && uf(S)) {
              var K = D.start, ee = D.end;
              if (ee === void 0 && (ee = K), "selectionStart" in S)
                S.selectionStart = K, S.selectionEnd = Math.min(
                  ee,
                  S.value.length
                );
              else {
                var se = S.ownerDocument || document, Y = se && se.defaultView || window;
                if (Y.getSelection) {
                  var F = Y.getSelection(), we = S.textContent.length, Ve = Math.min(D.start, we), rt = D.end === void 0 ? Ve : Math.min(D.end, we);
                  !F.extend && Ve > rt && (d = rt, rt = Ve, Ve = d);
                  var X = mg(
                    S,
                    Ve
                  ), L = mg(
                    S,
                    rt
                  );
                  if (X && L && (F.rangeCount !== 1 || F.anchorNode !== X.node || F.anchorOffset !== X.offset || F.focusNode !== L.node || F.focusOffset !== L.offset)) {
                    var Q = se.createRange();
                    Q.setStart(X.node, X.offset), F.removeAllRanges(), Ve > rt ? (F.addRange(Q), F.extend(L.node, L.offset)) : (Q.setEnd(L.node, L.offset), F.addRange(Q));
                  }
                }
              }
            }
            for (se = [], F = S; F = F.parentNode; )
              F.nodeType === 1 && se.push({
                element: F,
                left: F.scrollLeft,
                top: F.scrollTop
              });
            for (typeof S.focus == "function" && S.focus(), S = 0; S < se.length; S++) {
              var ue = se[S];
              ue.element.scrollLeft = ue.left, ue.element.scrollTop = ue.top;
            }
          }
          mr = !!Pd, Qd = Pd = null;
        } finally {
          Dt = u, xe.p = o, pe.T = a;
        }
      }
      e.current = t, rn = 2;
    }
  }
  function jd() {
    if (rn === 2) {
      rn = 0;
      var e = ca, t = bo, n = (t.flags & 8772) !== 0;
      if ((t.subtreeFlags & 8772) !== 0 || n) {
        n = pe.T, pe.T = null;
        var a = xe.p;
        xe.p = 2;
        var o = Dt;
        Dt |= 4;
        try {
          dp(e, t.alternate, t);
        } finally {
          Dt = o, xe.p = a, pe.T = n;
        }
      }
      rn = 3;
    }
  }
  function Hd() {
    if (rn === 4 || rn === 3) {
      rn = 0;
      var e = er;
      er = null, Wl();
      var t = ca, n = bo, a = Oa, o = Op, u = (a & 335544064) === a ? 10262 : 10256;
      if ((n.subtreeFlags & u) !== 0 || (n.flags & u) !== 0 ? rn = 5 : (rn = 0, bo = ca = null, Lp(t, t.pendingLanes)), u = t.pendingLanes, u === 0 && (_i = null), wn(a), n = n.stateNode, dt && typeof dt.onCommitFiberRoot == "function")
        try {
          dt.onCommitFiberRoot(
            Ot,
            n,
            void 0,
            (n.current.flags & 128) === 128
          );
        } catch {
        }
      if (o !== null) {
        n = pe.T, u = xe.p, xe.p = 2, pe.T = null;
        try {
          for (var d = t.onRecoverableError, S = 0; S < o.length; S++) {
            var D = o[S];
            d(D.value, {
              componentStack: D.stack
            });
          }
        } finally {
          pe.T = n, xe.p = u;
        }
      }
      if (o = tr, d = nr, nr = null, o !== null && (tr = null, d === null && (d = []), e !== null))
        for (D = 0; D < o.length; D++)
          n = (0, o[D])(
            d
          ), n !== void 0 && e.finished.finally(n);
      (Oa & 3) !== 0 && zs(), wa(t), u = t.pendingLanes, (a & 261930) !== 0 && (u & 42) !== 0 ? t === ws ? nu++ : (nu = 0, ws = t) : (nu = 0, ws = null), lu(0);
    }
  }
  function Lp(e, t) {
    (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Ir(t)));
  }
  function zs() {
    return er !== null && (er.skipTransition(), er = null), _d(), jd(), Hd(), Ud();
  }
  function Ud() {
    if (rn !== 5) return !1;
    var e = ca, t = Md;
    Md = 0;
    var n = wn(Oa), a = pe.T, o = xe.p;
    try {
      xe.p = 32 > n ? 32 : n, pe.T = null, n = Nd, Nd = null;
      var u = ca, d = Oa;
      if (rn = 0, bo = ca = null, Oa = 0, (Dt & 6) !== 0) throw Error(s(331));
      var S = Dt;
      if (Dt |= 4, Rp(u.current), Sp(
        u,
        u.current,
        d,
        n
      ), Dt = S, lu(0, !1), dt && typeof dt.onPostCommitFiberRoot == "function")
        try {
          dt.onPostCommitFiberRoot(Ot, u);
        } catch {
        }
      return !0;
    } finally {
      xe.p = o, pe.T = a, Lp(e, t);
    }
  }
  function Bp(e, t, n) {
    t = Xl(n, t), t = Wf(e.stateNode, t, 2), e = Ti(e, t, 2), e !== null && (ll(e, 2), wa(e));
  }
  function It(e, t, n) {
    if (e.tag === 3)
      Bp(e, e, n);
    else
      for (; t !== null; ) {
        if (t.tag === 3) {
          Bp(
            t,
            e,
            n
          );
          break;
        } else if (t.tag === 1) {
          var a = t.stateNode;
          if (typeof t.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (_i === null || !_i.has(a))) {
            e = Xl(n, e), n = Uh(2), a = Ti(t, n, 2), a !== null && (Ih(
              n,
              a,
              t,
              e
            ), ll(a, 2), wa(a));
            break;
          }
        }
        t = t.return;
      }
  }
  function Id(e, t, n) {
    var a = e.pingCache;
    if (a === null) {
      a = e.pingCache = new qx();
      var o = /* @__PURE__ */ new Set();
      a.set(t, o);
    } else
      o = a.get(t), o === void 0 && (o = /* @__PURE__ */ new Set(), a.set(t, o));
    o.has(n) || (Od = !0, o.add(n), e = Zx.bind(null, e, t, n), t.then(e, e));
  }
  function Zx(e, t, n) {
    var a = e.pingCache;
    a !== null && a.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, Gt === e && (yt & n) === n && ((dn === 4 || dn === 3 && (yt & 62914560) === yt && 300 > Zt() - Ts) && (Dt & 2) === 0 ? ar(e, 0) : Rs |= n, Wo === yt && (Wo = 0)), wa(e);
  }
  function qp(e, t) {
    t === 0 && (t = On()), e = to(e, t), e !== null && (ll(e, t), wa(e));
  }
  function Fx(e) {
    var t = e.memoizedState, n = 0;
    t !== null && (n = t.retryLane), qp(e, n);
  }
  function Jx(e, t) {
    var n = 0;
    switch (e.tag) {
      case 31:
      case 13:
        var a = e.stateNode, o = e.memoizedState;
        o !== null && (n = o.retryLane);
        break;
      case 19:
        a = e.stateNode;
        break;
      case 22:
        a = e.stateNode._retryCache;
        break;
      default:
        throw Error(s(314));
    }
    a !== null && a.delete(t), qp(e, n);
  }
  function $x(e, t) {
    return ql(e, t);
  }
  var or = null, rr = null, Vd = !1, _s = !1, Ld = !1, Hi = 0;
  function wa(e) {
    e !== rr && e.next === null && (rr === null ? or = rr = e : rr = rr.next = e), _s = !0, Vd || (Vd = !0, eS());
  }
  function lu(e, t) {
    if (!Ld && _s) {
      Ld = !0;
      do
        for (var n = !1, a = or; a !== null; ) {
          if (e !== 0) {
            var o = a.pendingLanes;
            if (o === 0) var u = 0;
            else {
              var d = a.suspendedLanes, S = a.pingedLanes;
              u = (1 << 31 - pt(42 | e) + 1) - 1, u &= o & ~(d & ~S), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
            }
            u !== 0 && (n = !0, Xp(a, u));
          } else
            u = yt, u = ut(
              a,
              a === Gt ? u : 0,
              a.cancelPendingCommit !== null || a.timeoutHandle !== -1
            ), (u & 3) === 0 || ml(a, u) || (n = !0, Xp(a, u));
          a = a.next;
        }
      while (n);
      Ld = !1;
    }
  }
  function Wx() {
    Gp();
  }
  function Gp() {
    _s = Vd = !1;
    var e = 0;
    Hi !== 0 && fS() && (e = Hi);
    for (var t = Zt(), n = null, a = or; a !== null; ) {
      var o = a.next, u = Yp(a, t);
      u === 0 ? (a.next = null, n === null ? or = o : n.next = o, o === null && (rr = n)) : (n = a, (e !== 0 || (u & 3) !== 0) && (_s = !0)), a = o;
    }
    rn !== 0 && rn !== 5 || lu(e), Hi !== 0 && (Hi = 0);
  }
  function Yp(e, t) {
    for (var n = e.suspendedLanes, a = e.pingedLanes, o = e.expirationTimes, u = e.pendingLanes & -62914561; 0 < u; ) {
      var d = 31 - pt(u), S = 1 << d, D = o[d];
      D === -1 ? ((S & n) === 0 || (S & a) !== 0) && (o[d] = _n(S, t)) : D <= t && (e.expiredLanes |= S), u &= ~S;
    }
    if (t = Gt, n = yt, n = ut(
      e,
      e === t ? n : 0,
      e.cancelPendingCommit !== null || e.timeoutHandle !== -1
    ), a = e.callbackNode, n === 0 || e === t && (Ut === 2 || Ut === 9) || e.cancelPendingCommit !== null)
      return a !== null && a !== null && yl(a), e.callbackNode = null, e.callbackPriority = 0;
    if ((n & 3) === 0 || ml(e, n)) {
      if (t = n & -n, t === e.callbackPriority) return t;
      switch (a !== null && yl(a), wn(n)) {
        case 2:
        case 8:
          n = $t;
          break;
        case 32:
          n = Bt;
          break;
        case 268435456:
          n = en;
          break;
        default:
          n = Bt;
      }
      return a = kp.bind(null, e), n = ql(n, a), e.callbackPriority = t, e.callbackNode = n, t;
    }
    return a !== null && a !== null && yl(a), e.callbackPriority = 2, e.callbackNode = null, 2;
  }
  function kp(e, t) {
    if (rn !== 0 && rn !== 5)
      return e.callbackNode = null, e.callbackPriority = 0, null;
    var n = e.callbackNode;
    if (zs() && e.callbackNode !== n)
      return null;
    var a = yt;
    return a = ut(
      e,
      e === Gt ? a : 0,
      e.cancelPendingCommit !== null || e.timeoutHandle !== -1
    ), a === 0 ? null : (Mp(e, a, t), Yp(e, Zt()), e.callbackNode != null && e.callbackNode === n ? kp.bind(null, e) : null);
  }
  function Xp(e, t) {
    if (zs()) return null;
    Mp(e, t, !0);
  }
  function eS() {
    mS(function() {
      (Dt & 6) !== 0 ? ql(
        Tn,
        Wx
      ) : Gp();
    });
  }
  function Bd() {
    if (Hi === 0) {
      var e = ro;
      e === 0 && (e = sn, sn <<= 1, (sn & 261888) === 0 && (sn = 256)), Hi = e;
    }
    return Hi;
  }
  function Kp(e) {
    return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : bn(e);
  }
  function tS(e, t, n, a, o) {
    if (t === "submit" && n && n.stateNode === o) {
      var u = Kp(
        (o[Mn] || null).action
      ), d = a.submitter;
      d && (t = (t = d[Mn] || null) ? Kp(t.formAction) : d.getAttribute("formAction"), t !== null && (u = t, d = null));
      var S = new _u(
        "action",
        "action",
        null,
        a,
        o
      );
      e.push({
        event: S,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (a.defaultPrevented) {
                if (Hi !== 0) {
                  var D = new FormData(o, d);
                  Qf(
                    n,
                    {
                      pending: !0,
                      data: D,
                      method: o.method,
                      action: u
                    },
                    null,
                    D
                  );
                }
              } else
                typeof u == "function" && (S.preventDefault(), D = new FormData(o, d), Qf(
                  n,
                  {
                    pending: !0,
                    data: D,
                    method: o.method,
                    action: u
                  },
                  u,
                  D
                ));
            },
            currentTarget: o
          }
        ]
      });
    }
  }
  for (var qd = 0; qd < df.length; qd++) {
    var Gd = df[qd], nS = Gd.toLowerCase(), lS = Gd[0].toUpperCase() + Gd.slice(1);
    oa(
      nS,
      "on" + lS
    );
  }
  oa(bg, "onAnimationEnd"), oa(yg, "onAnimationIteration"), oa(xg, "onAnimationStart"), oa("dblclick", "onDoubleClick"), oa("focusin", "onFocus"), oa("focusout", "onBlur"), oa(dx, "onTransitionRun"), oa(mx, "onTransitionStart"), oa(gx, "onTransitionCancel"), oa(Sg, "onTransitionEnd"), Nt("onMouseEnter", ["mouseout", "mouseover"]), Nt("onMouseLeave", ["mouseout", "mouseover"]), Nt("onPointerEnter", ["pointerout", "pointerover"]), Nt("onPointerLeave", ["pointerout", "pointerover"]), Ze(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), Ze(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), Ze("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), Ze(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), Ze(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), Ze(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var au = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), aS = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(au)
  );
  function Pp(e, t) {
    t = (t & 4) !== 0;
    for (var n = 0; n < e.length; n++) {
      var a = e[n], o = a.event;
      a = a.listeners;
      e: {
        var u = void 0;
        if (t)
          for (var d = a.length - 1; 0 <= d; d--) {
            var S = a[d], D = S.instance, K = S.currentTarget;
            if (S = S.listener, D !== u && o.isPropagationStopped())
              break e;
            u = S, o.currentTarget = K;
            try {
              u(o);
            } catch (ee) {
              Uu(ee);
            }
            o.currentTarget = null, u = D;
          }
        else
          for (d = 0; d < a.length; d++) {
            if (S = a[d], D = S.instance, K = S.currentTarget, S = S.listener, D !== u && o.isPropagationStopped())
              break e;
            u = S, o.currentTarget = K;
            try {
              u(o);
            } catch (ee) {
              Uu(ee);
            }
            o.currentTarget = null, u = D;
          }
      }
    }
  }
  function ht(e, t) {
    var n = t[gi];
    n === void 0 && (n = t[gi] = /* @__PURE__ */ new Set());
    var a = e + "__bubble";
    n.has(a) || (Qp(t, e, 2, !1), n.add(a));
  }
  function Yd(e, t, n) {
    var a = 0;
    t && (a |= 4), Qp(
      n,
      e,
      a,
      t
    );
  }
  var js = "_reactListening" + Math.random().toString(36).slice(2);
  function kd(e) {
    if (!e[js]) {
      e[js] = !0, Qe.forEach(function(n) {
        n !== "selectionchange" && (aS.has(n) || Yd(n, !1, e), Yd(n, !0, e));
      });
      var t = e.nodeType === 9 ? e : e.ownerDocument;
      t === null || t[js] || (t[js] = !0, Yd("selectionchange", !1, t));
    }
  }
  function Qp(e, t, n, a) {
    switch (Iv(t)) {
      case 2:
        var o = FS;
        break;
      case 8:
        o = JS;
        break;
      default:
        o = cm;
    }
    n = o.bind(
      null,
      t,
      n,
      e
    ), o = void 0, !We || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (o = !0), a ? o !== void 0 ? e.addEventListener(t, n, {
      capture: !0,
      passive: o
    }) : e.addEventListener(t, n, !0) : o !== void 0 ? e.addEventListener(t, n, {
      passive: o
    }) : e.addEventListener(t, n, !1);
  }
  function Xd(e, t, n, a, o) {
    var u = a;
    if ((t & 1) === 0 && (t & 2) === 0 && a !== null)
      e: for (; ; ) {
        if (a === null) return;
        var d = a.tag;
        if (d === 3 || d === 4) {
          var S = a.stateNode.containerInfo;
          if (S === o) break;
          if (d === 4)
            for (d = a.return; d !== null; ) {
              var D = d.tag;
              if ((D === 3 || D === 4) && d.stateNode.containerInfo === o)
                return;
              d = d.return;
            }
          for (; S !== null; ) {
            if (d = Sl(S), d === null) return;
            if (D = d.tag, D === 5 || D === 6 || D === 26 || D === 27) {
              a = u = d;
              continue e;
            }
            S = S.parentNode;
          }
        }
        a = a.return;
      }
    Xa(function() {
      var K = u, ee = ka(n), se = [];
      e: {
        var Y = Eg.get(e);
        if (Y !== void 0) {
          var F = _u, we = e;
          switch (e) {
            case "keypress":
              if (Vn(n) === 0) break e;
            case "keydown":
            case "keyup":
              F = G1;
              break;
            case "focusin":
              we = "focus", F = tf;
              break;
            case "focusout":
              we = "blur", F = tf;
              break;
            case "beforeblur":
            case "afterblur":
              F = tf;
              break;
            case "click":
              if (n.button === 2) break e;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              F = J0;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              F = N1;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              F = P1;
              break;
            case bg:
            case yg:
            case xg:
              F = _1;
              break;
            case Sg:
              F = Z1;
              break;
            case "scroll":
            case "scrollend":
              F = w1;
              break;
            case "wheel":
              F = J1;
              break;
            case "copy":
            case "cut":
            case "paste":
              F = H1;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              F = W0;
              break;
            case "submit":
              F = X1;
              break;
            case "toggle":
            case "beforetoggle":
              F = W1;
          }
          var Ve = (t & 4) !== 0, rt = !Ve && (e === "scroll" || e === "scrollend"), X = Ve ? Y !== null ? Y + "Capture" : null : Y;
          Ve = [];
          for (var L = K, Q; L !== null; ) {
            var ue = L;
            if (Q = ue.stateNode, ue = ue.tag, ue !== 5 && ue !== 26 && ue !== 27 || Q === null || X === null || (ue = he(L, X), ue != null && Ve.push(
              iu(L, ue, Q)
            )), rt) break;
            L = L.return;
          }
          0 < Ve.length && (Y = new F(
            Y,
            we,
            null,
            n,
            ee
          ), se.push({ event: Y, listeners: Ve }));
        }
      }
      if ((t & 7) === 0) {
        e: {
          if (F = e === "mouseover" || e === "pointerover", Y = e === "mouseout" || e === "pointerout", F && n !== Ya && (we = n.relatedTarget || n.fromElement) && (Sl(we) || we[jn]))
            break e;
          (Y || F) && (we = ee.window === ee ? ee : (F = ee.ownerDocument) ? F.defaultView || F.parentWindow : window, Y ? (F = n.relatedTarget || n.toElement, Y = K, F = F ? Sl(F) : null, F !== null && (rt = f(F), Ve = F.tag, F !== rt || Ve !== 5 && Ve !== 27 && Ve !== 6) && (F = null)) : (Y = null, F = K), Y !== F && (Ve = J0, ue = "onMouseLeave", X = "onMouseEnter", L = "mouse", (e === "pointerout" || e === "pointerover") && (Ve = W0, ue = "onPointerLeave", X = "onPointerEnter", L = "pointer"), rt = Y == null ? we : W(Y), Q = F == null ? we : W(F), we = new Ve(
            ue,
            L + "leave",
            Y,
            n,
            ee
          ), we.target = rt, we.relatedTarget = Q, ue = null, Sl(ee) === K && (Ve = new Ve(
            X,
            L + "enter",
            F,
            n,
            ee
          ), Ve.target = Q, Ve.relatedTarget = rt, ue = Ve), rt = ue, Ve = Y && F ? V(
            Y,
            F,
            iS
          ) : null, Y !== null && Zp(
            se,
            we,
            Y,
            Ve,
            !1
          ), F !== null && rt !== null && Zp(
            se,
            rt,
            F,
            Ve,
            !0
          )));
        }
        e: {
          if (Y = K ? W(K) : window, F = Y.nodeName && Y.nodeName.toLowerCase(), F === "select" || F === "input" && Y.type === "file")
            var _e = rg;
          else if (ig(Y))
            if (ug)
              _e = sx;
            else {
              _e = rx;
              var xt = ox;
            }
          else
            F = Y.nodeName, !F || F.toLowerCase() !== "input" || Y.type !== "checkbox" && Y.type !== "radio" ? K && va(K.elementType) && (_e = rg) : _e = ux;
          if (_e && (_e = _e(e, K))) {
            og(
              se,
              _e,
              n,
              ee
            );
            break e;
          }
          xt && xt(e, Y, K);
        }
        switch (xt = K ? W(K) : window, e) {
          case "focusin":
            (ig(xt) || xt.contentEditable === "true") && (Ho = xt, sf = K, jr = null);
            break;
          case "focusout":
            jr = sf = Ho = null;
            break;
          case "mousedown":
            cf = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            cf = !1, pg(se, n, ee);
            break;
          case "selectionchange":
            if (fx) break;
          case "keydown":
          case "keyup":
            pg(se, n, ee);
        }
        var Ge;
        if (lf)
          e: {
            switch (e) {
              case "compositionstart":
                var Je = "onCompositionStart";
                break e;
              case "compositionend":
                Je = "onCompositionEnd";
                break e;
              case "compositionupdate":
                Je = "onCompositionUpdate";
                break e;
            }
            Je = void 0;
          }
        else
          jo ? lg(e, n) && (Je = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (Je = "onCompositionStart");
        Je && (eg && n.locale !== "ko" && (jo || Je !== "onCompositionStart" ? Je === "onCompositionEnd" && jo && (Ge = on()) : (Mt = ee, an = "value" in Mt ? Mt.value : Mt.textContent, jo = !0)), xt = Hs(K, Je), 0 < xt.length && (Je = new $0(
          Je,
          e,
          null,
          n,
          ee
        ), se.push({ event: Je, listeners: xt }), Ge ? Je.data = Ge : (Ge = ag(n), Ge !== null && (Je.data = Ge)))), (Ge = tx ? nx(e, n) : lx(e, n)) && (Je = Hs(K, "onBeforeInput"), 0 < Je.length && (xt = new $0(
          "onBeforeInput",
          "beforeinput",
          null,
          n,
          ee
        ), se.push({
          event: xt,
          listeners: Je
        }), xt.data = Ge)), tS(
          se,
          e,
          K,
          n,
          ee
        );
      }
      Pp(se, t);
    });
  }
  function iu(e, t, n) {
    return {
      instance: e,
      listener: t,
      currentTarget: n
    };
  }
  function Hs(e, t) {
    for (var n = t + "Capture", a = []; e !== null; ) {
      var o = e, u = o.stateNode;
      if (o = o.tag, o !== 5 && o !== 26 && o !== 27 || u === null || (o = he(e, n), o != null && a.unshift(
        iu(e, o, u)
      ), o = he(e, t), o != null && a.push(
        iu(e, o, u)
      )), e.tag === 3) return a;
      e = e.return;
    }
    return [];
  }
  function iS(e) {
    if (e === null) return null;
    do
      e = e.return;
    while (e && e.tag !== 5 && e.tag !== 27);
    return e || null;
  }
  function Zp(e, t, n, a, o) {
    for (var u = t._reactName, d = []; n !== null && n !== a; ) {
      var S = n, D = S.alternate, K = S.stateNode;
      if (S = S.tag, D !== null && D === a) break;
      S !== 5 && S !== 26 && S !== 27 || K === null || (D = K, o ? (K = he(n, u), K != null && d.unshift(
        iu(n, K, D)
      )) : o || (K = he(n, u), K != null && d.push(
        iu(n, K, D)
      ))), n = n.return;
    }
    d.length !== 0 && e.push({ event: t, listeners: d });
  }
  var oS = /\r\n?/g, rS = /\u0000|\uFFFD/g;
  function Fp(e) {
    return (typeof e == "string" ? e : "" + e).replace(oS, `
`).replace(rS, "");
  }
  function Jp(e, t) {
    return t = Fp(t), Fp(e) === t;
  }
  function Vt(e, t, n, a, o, u) {
    switch (n) {
      case "children":
        if (typeof a == "string")
          t === "body" || t === "textarea" && a === "" || pn(e, a);
        else if (typeof a == "number" || typeof a == "bigint")
          t !== "body" && pn(e, "" + a);
        else return;
        break;
      case "className":
        Un(e, "class", a);
        break;
      case "tabIndex":
        Un(e, "tabindex", a);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        Un(e, n, a);
        break;
      case "style":
        vn(e, a, u);
        return;
      case "data":
        if (t !== "object") {
          Un(e, "data", a);
          break;
        }
      case "src":
      case "href":
        if (a === "" && (t !== "a" || n !== "href")) {
          e.removeAttribute(n);
          break;
        }
        if (a == null || typeof a == "function" || typeof a == "symbol" || typeof a == "boolean") {
          e.removeAttribute(n);
          break;
        }
        a = bn(a), e.setAttribute(n, a);
        break;
      case "action":
      case "formAction":
        if (typeof a == "function") {
          e.setAttribute(
            n,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof u == "function" && (n === "formAction" ? (t !== "input" && Vt(e, t, "name", o.name, o, null), Vt(
            e,
            t,
            "formEncType",
            o.formEncType,
            o,
            null
          ), Vt(
            e,
            t,
            "formMethod",
            o.formMethod,
            o,
            null
          ), Vt(
            e,
            t,
            "formTarget",
            o.formTarget,
            o,
            null
          )) : (Vt(e, t, "encType", o.encType, o, null), Vt(e, t, "method", o.method, o, null), Vt(e, t, "target", o.target, o, null)));
        if (a == null || typeof a == "symbol" || typeof a == "boolean") {
          e.removeAttribute(n);
          break;
        }
        a = bn(a), e.setAttribute(n, a);
        break;
      case "onClick":
        a != null && (e.onclick = In);
        return;
      case "onScroll":
        a != null && ht("scroll", e);
        return;
      case "onScrollEnd":
        a != null && ht("scrollend", e);
        return;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a))
            throw Error(s(61));
          if (n = a.__html, n != null) {
            if (o.children != null) throw Error(s(60));
            u?.__html !== n && (e.innerHTML = n);
          }
        }
        break;
      case "multiple":
        e.multiple = a && typeof a != "function" && typeof a != "symbol";
        break;
      case "muted":
        e.muted = a && typeof a != "function" && typeof a != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (a == null || typeof a == "function" || typeof a == "boolean" || typeof a == "symbol") {
          e.removeAttribute("xlink:href");
          break;
        }
        n = bn(a), e.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          n
        );
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        a != null && typeof a != "function" && typeof a != "symbol" ? e.setAttribute(n, a) : e.removeAttribute(n);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "credentialless":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        a && typeof a != "function" && typeof a != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
        break;
      case "capture":
      case "download":
        a === !0 ? e.setAttribute(n, "") : a !== !1 && a != null && typeof a != "function" && typeof a != "symbol" ? e.setAttribute(n, a) : e.removeAttribute(n);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        a != null && typeof a != "function" && typeof a != "symbol" && !isNaN(a) && 1 <= a ? e.setAttribute(n, a) : e.removeAttribute(n);
        break;
      case "rowSpan":
      case "start":
        a == null || typeof a == "function" || typeof a == "symbol" || isNaN(a) ? e.removeAttribute(n) : e.setAttribute(n, a);
        break;
      case "popover":
        ht("beforetoggle", e), ht("toggle", e), Jt(e, "popover", a);
        break;
      case "xlinkActuate":
        cn(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          a
        );
        break;
      case "xlinkArcrole":
        cn(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          a
        );
        break;
      case "xlinkRole":
        cn(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          a
        );
        break;
      case "xlinkShow":
        cn(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          a
        );
        break;
      case "xlinkTitle":
        cn(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          a
        );
        break;
      case "xlinkType":
        cn(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          a
        );
        break;
      case "xmlBase":
        cn(
          e,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          a
        );
        break;
      case "xmlLang":
        cn(
          e,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          a
        );
        break;
      case "xmlSpace":
        cn(
          e,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          a
        );
        break;
      case "is":
        Jt(e, "is", a);
        break;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N")
          n = pi.get(n) || n, Jt(e, n, a);
        else return;
    }
    Xe = !0;
  }
  function Kd(e, t, n, a, o, u) {
    switch (n) {
      case "style":
        vn(e, a, u);
        return;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a))
            throw Error(s(61));
          if (n = a.__html, n != null) {
            if (o.children != null) throw Error(s(60));
            u?.__html !== n && (e.innerHTML = n);
          }
        }
        break;
      case "children":
        if (typeof a == "string") pn(e, a);
        else if (typeof a == "number" || typeof a == "bigint")
          pn(e, "" + a);
        else return;
        break;
      case "onScroll":
        a != null && ht("scroll", e);
        return;
      case "onScrollEnd":
        a != null && ht("scrollend", e);
        return;
      case "onClick":
        a != null && (e.onclick = In);
        return;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        return;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!qe.hasOwnProperty(n))
          e: {
            if (n[0] === "o" && n[1] === "n" && (o = n.endsWith("Capture"), u = n.slice(2, o ? n.length - 7 : void 0), t = e[Mn] || null, t = t != null ? t[n] : null, typeof t == "function" && e.removeEventListener(u, t, o), typeof a == "function")) {
              typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(u, a, o);
              break e;
            }
            Xe = !0, n in e ? e[n] = a : a === !0 ? e.setAttribute(n, "") : Jt(e, n, a);
          }
        return;
    }
    Xe = !0;
  }
  function Fn(e, t, n) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        ht("error", e), ht("load", e);
        var a = !1, o = !1, u;
        for (u in n)
          if (n.hasOwnProperty(u)) {
            var d = n[u];
            if (d != null)
              switch (u) {
                case "src":
                  a = !0;
                  break;
                case "srcSet":
                  o = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(s(137, t));
                default:
                  Vt(e, t, u, d, n, null);
              }
          }
        o && Vt(e, t, "srcSet", n.srcSet, n, null), a && Vt(e, t, "src", n.src, n, null);
        return;
      case "input":
        ht("invalid", e);
        var S = u = d = o = null, D = null, K = null;
        for (a in n)
          if (n.hasOwnProperty(a)) {
            var ee = n[a];
            if (ee != null)
              switch (a) {
                case "name":
                  o = ee;
                  break;
                case "type":
                  d = ee;
                  break;
                case "checked":
                  D = ee;
                  break;
                case "defaultChecked":
                  K = ee;
                  break;
                case "value":
                  u = ee;
                  break;
                case "defaultValue":
                  S = ee;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (ee != null)
                    throw Error(s(137, t));
                  break;
                default:
                  Vt(e, t, a, ee, n, null);
              }
          }
        ha(
          e,
          u,
          S,
          D,
          K,
          d,
          o,
          !1
        );
        return;
      case "select":
        ht("invalid", e), a = d = u = null;
        for (o in n)
          if (n.hasOwnProperty(o) && (S = n[o], S != null))
            switch (o) {
              case "value":
                u = S;
                break;
              case "defaultValue":
                d = S;
                break;
              case "multiple":
                a = S;
              default:
                Vt(e, t, o, S, n, null);
            }
        t = u, n = d, e.multiple = !!a, t != null ? Xn(e, !!a, t, !1) : n != null && Xn(e, !!a, n, !0);
        return;
      case "textarea":
        ht("invalid", e), u = o = a = null;
        for (d in n)
          if (n.hasOwnProperty(d) && (S = n[d], S != null))
            switch (d) {
              case "value":
                a = S;
                break;
              case "defaultValue":
                o = S;
                break;
              case "children":
                u = S;
                break;
              case "dangerouslySetInnerHTML":
                if (S != null) throw Error(s(91));
                break;
              default:
                Vt(e, t, d, S, n, null);
            }
        il(e, a, o, u);
        return;
      case "option":
        for (D in n)
          n.hasOwnProperty(D) && (a = n[D], a != null) && (D === "selected" ? e.selected = a && typeof a != "function" && typeof a != "symbol" : Vt(e, t, D, a, n, null));
        return;
      case "dialog":
        ht("beforetoggle", e), ht("toggle", e), ht("cancel", e), ht("close", e);
        break;
      case "iframe":
      case "object":
        ht("load", e);
        break;
      case "video":
      case "audio":
        for (a = 0; a < au.length; a++)
          ht(au[a], e);
        break;
      case "image":
        ht("error", e), ht("load", e);
        break;
      case "details":
        ht("toggle", e);
        break;
      case "embed":
      case "source":
      case "link":
        ht("error", e), ht("load", e);
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (K in n)
          if (n.hasOwnProperty(K) && (a = n[K], a != null))
            switch (K) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(s(137, t));
              default:
                Vt(e, t, K, a, n, null);
            }
        return;
      default:
        if (va(t)) {
          for (ee in n)
            n.hasOwnProperty(ee) && (a = n[ee], a !== void 0 && Kd(
              e,
              t,
              ee,
              a,
              n,
              void 0
            ));
          return;
        }
    }
    for (S in n)
      n.hasOwnProperty(S) && (a = n[S], a != null && Vt(e, t, S, a, n, null));
  }
  var uS = {};
  function sS(e, t, n, a) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var o = null, u = null, d = null, S = null, D = null, K = null, ee = null;
        for (F in n) {
          var se = n[F];
          if (n.hasOwnProperty(F) && se != null)
            switch (F) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                D = se;
              default:
                a.hasOwnProperty(F) || Vt(e, t, F, null, a, se);
            }
        }
        for (var Y in a) {
          var F = a[Y];
          if (se = n[Y], a.hasOwnProperty(Y) && (F != null || se != null))
            switch (Y) {
              case "type":
                F !== se && (Xe = !0), u = F;
                break;
              case "name":
                F !== se && (Xe = !0), o = F;
                break;
              case "checked":
                F !== se && (Xe = !0), K = F;
                break;
              case "defaultChecked":
                F !== se && (Xe = !0), ee = F;
                break;
              case "value":
                F !== se && (Xe = !0), d = F;
                break;
              case "defaultValue":
                F !== se && (Xe = !0), S = F;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (F != null)
                  throw Error(s(137, t));
                break;
              default:
                F !== se && Vt(
                  e,
                  t,
                  Y,
                  F,
                  a,
                  se
                );
            }
        }
        Nn(
          e,
          d,
          S,
          D,
          K,
          ee,
          u,
          o
        );
        return;
      case "select":
        F = d = S = Y = null;
        for (u in n)
          if (D = n[u], n.hasOwnProperty(u) && D != null)
            switch (u) {
              case "value":
                break;
              case "multiple":
                F = D;
              default:
                a.hasOwnProperty(u) || Vt(
                  e,
                  t,
                  u,
                  null,
                  a,
                  D
                );
            }
        for (o in a)
          if (u = a[o], D = n[o], a.hasOwnProperty(o) && (u != null || D != null))
            switch (o) {
              case "value":
                u !== D && (Xe = !0), Y = u;
                break;
              case "defaultValue":
                u !== D && (Xe = !0), S = u;
                break;
              case "multiple":
                u !== D && (Xe = !0), d = u;
              default:
                u !== D && Vt(
                  e,
                  t,
                  o,
                  u,
                  a,
                  D
                );
            }
        t = S, n = d, a = F, Y != null ? Xn(e, !!n, Y, !1) : !!a != !!n && (t != null ? Xn(e, !!n, t, !0) : Xn(e, !!n, n ? [] : "", !1));
        return;
      case "textarea":
        F = Y = null;
        for (S in n)
          if (o = n[S], n.hasOwnProperty(S) && o != null && !a.hasOwnProperty(S))
            switch (S) {
              case "value":
                break;
              case "children":
                break;
              default:
                Vt(e, t, S, null, a, o);
            }
        for (d in a)
          if (o = a[d], u = n[d], a.hasOwnProperty(d) && (o != null || u != null))
            switch (d) {
              case "value":
                o !== u && (Xe = !0), Y = o;
                break;
              case "defaultValue":
                o !== u && (Xe = !0), F = o;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (o != null) throw Error(s(91));
                break;
              default:
                o !== u && Vt(e, t, d, o, a, u);
            }
        la(e, Y, F);
        return;
      case "option":
        for (var we in n)
          Y = n[we], n.hasOwnProperty(we) && Y != null && !a.hasOwnProperty(we) && (we === "selected" ? e.selected = !1 : Vt(
            e,
            t,
            we,
            null,
            a,
            Y
          ));
        for (D in a)
          Y = a[D], F = n[D], a.hasOwnProperty(D) && Y !== F && (Y != null || F != null) && (D === "selected" ? (Y !== F && (Xe = !0), e.selected = Y && typeof Y != "function" && typeof Y != "symbol") : Vt(
            e,
            t,
            D,
            Y,
            a,
            F
          ));
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var Ve in n)
          Y = n[Ve], n.hasOwnProperty(Ve) && Y != null && !a.hasOwnProperty(Ve) && Vt(e, t, Ve, null, a, Y);
        for (K in a)
          if (Y = a[K], F = n[K], a.hasOwnProperty(K) && Y !== F && (Y != null || F != null))
            switch (K) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (Y != null)
                  throw Error(s(137, t));
                break;
              default:
                Vt(
                  e,
                  t,
                  K,
                  Y,
                  a,
                  F
                );
            }
        return;
      default:
        if (va(t)) {
          for (var rt in n)
            Y = n[rt], n.hasOwnProperty(rt) && Y !== void 0 && !a.hasOwnProperty(rt) && Kd(
              e,
              t,
              rt,
              void 0,
              a,
              Y
            );
          for (ee in a)
            Y = a[ee], F = n[ee], !a.hasOwnProperty(ee) || Y === F || Y === void 0 && F === void 0 || Kd(
              e,
              t,
              ee,
              Y,
              a,
              F
            );
          return;
        }
    }
    for (var X in n)
      Y = n[X], n.hasOwnProperty(X) && Y != null && !a.hasOwnProperty(X) && Vt(e, t, X, null, a, Y);
    for (se in a)
      Y = a[se], F = n[se], !a.hasOwnProperty(se) || Y === F || Y == null && F == null || Vt(e, t, se, Y, a, F);
  }
  function $p(e) {
    switch (e) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function cS() {
    if (typeof performance.getEntriesByType == "function") {
      for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), a = 0; a < n.length; a++) {
        var o = n[a], u = o.transferSize, d = o.initiatorType, S = o.duration;
        if (u && S && $p(d)) {
          for (d = 0, S = o.responseEnd, a += 1; a < n.length; a++) {
            var D = n[a], K = D.startTime;
            if (K > S) break;
            var ee = D.transferSize, se = D.initiatorType;
            ee && $p(se) && (D = D.responseEnd, d += ee * (D < S ? 1 : (S - K) / (D - K)));
          }
          if (--a, t += 8 * (u + d) / (o.duration / 1e3), e++, 10 < e) break;
        }
      }
      if (0 < e) return t / e / 1e6;
    }
    return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
  }
  var Pd = null, Qd = null;
  function ou(e) {
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  function Wp(e) {
    switch (e) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function ev(e, t) {
    if (e === 0)
      switch (t) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return e === 1 && t === "foreignObject" ? 0 : e;
  }
  function tv(e, t, n, a) {
    return n = ou(
      n
    ).createElement(e), n[Xt] = a, n[Mn] = t, Fn(n, e, t), me(n), n;
  }
  function Zd(e, t) {
    return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
  }
  var Fd = null;
  function fS() {
    var e = window.event;
    return e && e.type === "popstate" ? e === Fd ? !1 : (Fd = e, !0) : (Fd = null, !1);
  }
  var Jd = typeof setTimeout == "function" ? setTimeout : void 0, dS = typeof clearTimeout == "function" ? clearTimeout : void 0, nv = typeof Promise == "function" ? Promise : void 0, lv = typeof requestAnimationFrame == "function" ? requestAnimationFrame : Jd, mS = typeof queueMicrotask == "function" ? queueMicrotask : typeof nv < "u" ? function(e) {
    return nv.resolve(null).then(e).catch(gS);
  } : Jd;
  function gS(e) {
    setTimeout(function() {
      throw e;
    });
  }
  function Ui(e) {
    return e === "head";
  }
  function av(e, t) {
    var n = t, a = 0;
    do {
      var o = n.nextSibling;
      if (e.removeChild(n), o && o.nodeType === 8)
        if (n = o.data, n === "/$" || n === "/&") {
          if (a === 0) {
            e.removeChild(o), gr(t);
            return;
          }
          a--;
        } else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&")
          a++;
        else if (n === "html")
          im(
            e.ownerDocument.documentElement
          );
        else if (n === "head") {
          n = e.ownerDocument.head, im(n);
          for (var u = n.firstChild; u; ) {
            var d = u.nextSibling, S = u.nodeName;
            u[Ft] || S === "SCRIPT" || S === "STYLE" || S === "LINK" && u.rel.toLowerCase() === "stylesheet" || n.removeChild(u), u = d;
          }
        } else
          n === "body" && im(e.ownerDocument.body);
      n = o;
    } while (n);
    gr(t);
  }
  function iv(e, t) {
    var n = e;
    e = 0;
    do {
      var a = n.nextSibling;
      if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), a && a.nodeType === 8)
        if (n = a.data, n === "/$") {
          if (e === 0) break;
          e--;
        } else
          n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
      n = a;
    } while (n);
  }
  function ov(e, t, n) {
    if (t = CSS.escape(t) !== t ? "r-" + btoa(t).replace(/=/g, "") : t, e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
      if (t = e.getClientRects(), t.length === 1) var a = 1;
      else
        for (var o = a = 0; o < t.length; o++) {
          var u = t[o];
          0 < u.width && 0 < u.height && a++;
        }
      a === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
    }
  }
  function rv(e, t) {
    e = e.style, t = t.style;
    var n = t != null ? t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null : null;
    e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t != null ? t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n != null ? e.margin = n : (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t)));
  }
  function hS(e, t, n) {
    return n = n.ownerDocument.defaultView, {
      rect: e,
      abs: t.position === "absolute" || t.position === "fixed",
      clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
      view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
    };
  }
  function $d(e) {
    var t = e.getBoundingClientRect(), n = getComputedStyle(e);
    return hS(t, n, e);
  }
  function pS(e) {
    return e.documentElement.clientHeight;
  }
  function vS(e) {
    this.addEventListener("load", e), this.addEventListener("error", e);
  }
  function bS(e, t, n, a, o, u, d, S, D) {
    var K = t.nodeType === 9 ? t : t.ownerDocument;
    try {
      var ee = K.startViewTransition({
        update: function() {
          var Y = K.defaultView, F = Y.navigation && Y.navigation.transition, we = K.fonts.status;
          a();
          var Ve = [];
          if (we === "loaded" && (pS(K), K.fonts.status === "loading" && Ve.push(K.fonts.ready)), we = Ve.length, e !== null)
            for (var rt = e.suspenseyImages, X = 0, L = 0; L < rt.length; L++) {
              var Q = rt[L];
              if (!Q.complete) {
                var ue = Q.getBoundingClientRect();
                if (0 < ue.bottom && 0 < ue.right && ue.top < Y.innerHeight && ue.left < Y.innerWidth) {
                  if (X += wv(Q), X > Vs) {
                    Ve.length = we;
                    break;
                  }
                  Q = new Promise(
                    vS.bind(Q)
                  ), Ve.push(Q);
                }
              }
            }
          if (0 < Ve.length)
            return Y = Promise.race([
              Promise.all(Ve),
              new Promise(function(_e) {
                return setTimeout(_e, 500);
              })
            ]).then(o, o), (F ? Promise.allSettled([F.finished, Y]) : Y).then(u, u);
          if (o(), F)
            return F.finished.then(
              u,
              u
            );
          u();
        },
        types: n
      });
      K.__reactViewTransition = ee;
      var se = [];
      return ee.ready.then(
        function() {
          for (var Y = K.documentElement.getAnimations({
            subtree: !0
          }), F = 0; F < Y.length; F++) {
            var we = Y[F], Ve = we.effect, rt = Ve.pseudoElement;
            if (rt != null && rt.startsWith("::view-transition")) {
              se.push(we), we = Ve.getKeyframes();
              for (var X = rt = void 0, L = !0, Q = 0; Q < we.length; Q++) {
                var ue = we[Q], _e = ue.width;
                if (rt === void 0) rt = _e;
                else if (rt !== _e) {
                  L = !1;
                  break;
                }
                if (_e = ue.height, X === void 0) X = _e;
                else if (X !== _e) {
                  L = !1;
                  break;
                }
                delete ue.width, delete ue.height, ue.transform === "none" && delete ue.transform;
              }
              L && rt !== void 0 && X !== void 0 && (Ve.setKeyframes(we), L = getComputedStyle(
                Ve.target,
                Ve.pseudoElement
              ), L.width !== rt || L.height !== X) && (L = we[0], L.width = rt, L.height = X, L = we[we.length - 1], L.width = rt, L.height = X, Ve.setKeyframes(we));
            }
          }
          d();
        },
        function(Y) {
          K.__reactViewTransition === ee && (K.__reactViewTransition = null);
          try {
            typeof Y == "object" && Y !== null && Y.name === "InvalidStateError" && (Y.message === "View transition was skipped because document visibility state is hidden." || Y.message === "Skipping view transition because document visibility state has become hidden." || Y.message === "Skipping view transition because viewport size changed." || Y.message === "Transition was aborted because of invalid state") && (Y = null), Y !== null && D(Y);
          } finally {
            a(), o(), d();
          }
        }
      ), ee.finished.finally(function() {
        for (var Y = 0; Y < se.length; Y++)
          se[Y].cancel();
        K.__reactViewTransition === ee && (K.__reactViewTransition = null), S();
      }), ee;
    } catch {
      return a(), o(), d(), null;
    }
  }
  function yo(e, t) {
    this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
  }
  yo.prototype.animate = function(e, t) {
    return t = typeof t == "number" ? { duration: t } : _({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
  }, yo.prototype.getAnimations = function() {
    for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), a = [], o = 0; o < n.length; o++) {
      var u = n[o].effect;
      u !== null && u.target === e && u.pseudoElement === t && a.push(n[o]);
    }
    return a;
  }, yo.prototype.getComputedStyle = function() {
    return getComputedStyle(this._scope, this._selector);
  };
  function uv(e) {
    return {
      name: e,
      group: new yo("group", e),
      imagePair: new yo("image-pair", e),
      old: new yo("old", e),
      new: new yo("new", e)
    };
  }
  function Il(e) {
    this._fragmentFiber = e, this._observers = this._eventListeners = null;
  }
  Il.prototype.addEventListener = function(e, t, n) {
    var a = null, o = null;
    if (!(n != null && typeof n != "boolean" && (a = n.signal || null, a !== null && a.aborted))) {
      this._eventListeners === null && (this._eventListeners = []);
      var u = this._eventListeners;
      if (cv(u, e, t, n) === -1) {
        var d = this, S = t;
        n != null && typeof n != "boolean" && n.once === !0 && (S = function(D) {
          d.removeEventListener(
            e,
            t,
            n
          ), typeof t == "function" ? t.call(this, D) : t.handleEvent(D);
        }), a !== null && (o = d.removeEventListener.bind(
          d,
          e,
          t,
          n
        ), a.addEventListener("abort", o, { once: !0 }), o = a.removeEventListener.bind(a, "abort", o)), a = ur(n), u.push({
          type: e,
          listener: t,
          optionsOrUseCapture: n,
          attachedListener: S,
          cleanup: o
        }), g(
          this._fragmentFiber.child,
          !1,
          yS,
          e,
          S,
          a
        );
      }
      this._eventListeners = u;
    }
  };
  function yS(e, t, n, a) {
    return E(e).addEventListener(
      t,
      n,
      a
    ), !1;
  }
  Il.prototype.removeEventListener = function(e, t, n) {
    var a = this._eventListeners;
    if (a !== null && (t = cv(
      a,
      e,
      t,
      n
    ), t !== -1)) {
      var o = a[t];
      n = o.attachedListener;
      var u = o.cleanup;
      o = ur(o.optionsOrUseCapture), g(
        this._fragmentFiber.child,
        !1,
        xS,
        e,
        n,
        o
      ), a.splice(t, 1), u !== null && u();
    }
  };
  function xS(e, t, n, a) {
    return E(e).removeEventListener(
      t,
      n,
      a
    ), !1;
  }
  function ur(e) {
    return e != null && typeof e != "boolean" && (e.once === !0 || e.signal instanceof AbortSignal) ? { capture: e.capture, passive: e.passive } : e;
  }
  function sv(e) {
    return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
  }
  function cv(e, t, n, a) {
    if (e.length === 0) return -1;
    a = sv(a);
    for (var o = 0; o < e.length; o++) {
      var u = e[o];
      if (u.type === t && u.listener === n && sv(u.optionsOrUseCapture) === a)
        return o;
    }
    return -1;
  }
  Il.prototype.dispatchEvent = function(e) {
    var t = x(
      this._fragmentFiber
    );
    if (t === null) return !0;
    t = E(t);
    var n = this._eventListeners;
    if (n !== null && 0 < n.length || !e.bubbles) {
      var a = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
      if (n)
        for (var o = 0; o < n.length; o++) {
          var u = n[o];
          a.addEventListener(
            u.type,
            u.attachedListener,
            ur(u.optionsOrUseCapture)
          );
        }
      if (t.appendChild(a), e = a.dispatchEvent(e), n)
        for (o = 0; o < n.length; o++)
          u = n[o], a.removeEventListener(
            u.type,
            u.attachedListener,
            ur(u.optionsOrUseCapture)
          );
      return t.removeChild(a), e;
    }
    return t.dispatchEvent(e);
  }, Il.prototype.focus = function(e) {
    g(
      this._fragmentFiber.child,
      !0,
      fv,
      e,
      void 0,
      void 0
    );
  };
  function fv(e, t) {
    return e.tag === 6 ? !1 : (e = E(e), zS(e, t));
  }
  Il.prototype.focusLast = function(e) {
    var t = [];
    g(
      this._fragmentFiber.child,
      !0,
      Wd,
      t,
      void 0,
      void 0
    );
    for (var n = t.length - 1; 0 <= n && !fv(t[n], e); n--) ;
  };
  function Wd(e, t) {
    return t.push(e), !1;
  }
  Il.prototype.blur = function() {
    var e = x(
      this._fragmentFiber
    );
    e !== null && (e = E(e), e = ou(e).activeElement, e !== null && g(
      this._fragmentFiber.child,
      !1,
      SS,
      e,
      void 0,
      void 0
    ));
  };
  function SS(e, t) {
    return e.tag === 6 ? !1 : (e = E(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
  }
  Il.prototype.observeUsing = function(e) {
    this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), g(
      this._fragmentFiber.child,
      !1,
      ES,
      e,
      void 0,
      void 0
    );
  };
  function ES(e, t) {
    return e.tag === 6 || (e = E(e), t.observe(e)), !1;
  }
  Il.prototype.unobserveUsing = function(e) {
    var t = this._observers;
    if (t !== null && t.has(e)) {
      t.delete(e), g(
        this._fragmentFiber.child,
        !1,
        CS,
        e,
        void 0,
        void 0
      );
      for (var n = t = 0; n < fa.length; n++) {
        var a = fa[n];
        a.fragmentInstance === this && a.observer === e ? e.unobserve(a.instance) : fa[t++] = a;
      }
      fa.length = t;
    }
  };
  function CS(e, t) {
    return e.tag === 6 || (e = E(e), t.unobserve(e)), !1;
  }
  var fa = [], em = !1;
  function RS(e, t, n) {
    fa.push({
      fragmentInstance: e,
      observer: t,
      instance: n
    }), em || (em = !0, _S(function() {
      em = !1;
      var a = fa;
      fa = [];
      for (var o = 0; o < a.length; o++) {
        var u = a[o];
        u.observer.unobserve(u.instance);
      }
    }));
  }
  Il.prototype.getClientRects = function() {
    var e = [];
    return g(
      this._fragmentFiber.child,
      !1,
      TS,
      e,
      void 0,
      void 0
    ), e;
  };
  function TS(e, t) {
    if (e.tag === 6) {
      e = e.stateNode;
      var n = e.ownerDocument.createRange();
      n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
    } else
      e = E(e), t.push.apply(t, e.getClientRects());
    return !1;
  }
  Il.prototype.getRootNode = function(e) {
    var t = x(
      this._fragmentFiber
    );
    return t === null ? this : E(t).getRootNode(e);
  }, Il.prototype.compareDocumentPosition = function(e) {
    var t = x(
      this._fragmentFiber
    );
    if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
    var n = [];
    g(
      this._fragmentFiber.child,
      !1,
      Wd,
      n,
      void 0,
      void 0
    );
    var a = E(t);
    if (n.length === 0) {
      if (n = a, T(this._fragmentFiber)) {
        e: {
          for (t = this._fragmentFiber.return; t !== null; ) {
            if (t.tag === 4) {
              t = t.stateNode.containerInfo;
              break e;
            }
            if (t.tag === 3 || t.tag === 5 || t.tag === 27)
              break;
            t = t.return;
          }
          t = null;
        }
        t != null && (n = t);
      }
      t = this._fragmentFiber;
      var o = a = n.compareDocumentPosition(e);
      return n === e ? o = Node.DOCUMENT_POSITION_CONTAINS : a & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = A(t)[1], n === null ? o = Node.DOCUMENT_POSITION_PRECEDING : (e = E(n).compareDocumentPosition(
        e
      ), o = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), o |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
    }
    t = E(n[0]), o = E(n[n.length - 1]);
    var u = T(this._fragmentFiber) ? t.parentElement : a;
    if (u == null)
      return Node.DOCUMENT_POSITION_DISCONNECTED;
    a = u.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, u = u.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_CONTAINED_BY;
    var d = t.compareDocumentPosition(e), S = o.compareDocumentPosition(e), D = d & Node.DOCUMENT_POSITION_CONTAINED_BY || S & Node.DOCUMENT_POSITION_CONTAINED_BY;
    return S = a && u && d & Node.DOCUMENT_POSITION_FOLLOWING && S & Node.DOCUMENT_POSITION_PRECEDING, t = a && t === e || u && o === e || D || S ? Node.DOCUMENT_POSITION_CONTAINED_BY : !a && t === e || !u && o === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : d, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || AS(
      t,
      this._fragmentFiber,
      n[0],
      n[n.length - 1],
      e
    ) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
  };
  function AS(e, t, n, a, o) {
    var u = Sl(o);
    if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      if (n = !!u)
        e: {
          for (; u !== null; ) {
            if (u.tag === 7 && (u === t || u.alternate === t)) {
              n = !0;
              break e;
            }
            u = u.return;
          }
          n = !1;
        }
      return n;
    }
    if (e & Node.DOCUMENT_POSITION_CONTAINS) {
      if (u === null)
        return u = o.ownerDocument, o === u || o === u.documentElement || o === u.body;
      e: {
        for (u = t, t = x(t); u !== null; ) {
          if (!(u.tag !== 5 && u.tag !== 3 && u.tag !== 27 || u !== t && u.alternate !== t)) {
            u = !0;
            break e;
          }
          u = u.return;
        }
        u = !1;
      }
      return u;
    }
    return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!u) && !(t = u === n) && (t = V(
      n,
      u,
      z
    ), t === null ? t = !1 : (g(
      t,
      !0,
      I,
      u,
      n
    ), u = M, M = null, t = u !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!u) && !(t = u === a) && (t = V(
      a,
      u,
      z
    ), t === null ? t = !1 : (g(
      t,
      !0,
      C,
      u,
      a
    ), u = M, R = M = null, t = u !== null)), t) : !1;
  }
  function dv(e, t) {
    var n = e.ownerDocument.createRange();
    n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(
      window.scrollX + e.left,
      t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight
    );
  }
  Il.prototype.scrollIntoView = function(e) {
    if (typeof e == "object") throw Error(s(566));
    var t = [];
    g(
      this._fragmentFiber.child,
      !1,
      Wd,
      t,
      void 0,
      void 0
    );
    var n = e !== !1;
    if (t.length === 0) {
      var a = A(
        this._fragmentFiber
      );
      if (a = n ? a[1] || a[0] || x(this._fragmentFiber) : a[0] || a[1], a === null) return;
      if (a.tag === 6) {
        e = E(a), dv(e, n);
        return;
      }
      if (a = E(a), a.nodeType !== 9) {
        if (a.nodeType === 11) {
          n = "host" in a ? a.host : null, n !== null && n.scrollIntoView(e);
          return;
        }
        a.scrollIntoView(e);
      }
    }
    for (a = n ? t.length - 1 : 0; a !== (n ? -1 : t.length); ) {
      var o = t[a];
      o.tag === 6 ? (o = E(o), dv(o, n)) : E(o).scrollIntoView(e), a += n ? -1 : 1;
    }
  };
  function OS(e, t) {
    return e = E(e), mv(e, t), !1;
  }
  function mv(e, t) {
    e.reactFragments == null && (e.reactFragments = /* @__PURE__ */ new Set()), e.reactFragments.add(t);
  }
  function gv(e, t) {
    var n = t._eventListeners;
    if (n !== null)
      for (var a = 0; a < n.length; a++) {
        var o = n[a];
        e.addEventListener(
          o.type,
          o.attachedListener,
          ur(o.optionsOrUseCapture)
        );
      }
    e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(u) {
      for (var d = 0, S = 0; S < fa.length; S++) {
        var D = fa[S];
        (D.fragmentInstance !== t || D.observer !== u || D.instance !== e) && (fa[d++] = D);
      }
      fa.length = d, u.observe(e);
    }), mv(e, t));
  }
  function wS(e, t) {
    var n = t._eventListeners;
    if (n !== null)
      for (var a = 0; a < n.length; a++) {
        var o = n[a];
        e.removeEventListener(
          o.type,
          o.attachedListener,
          ur(o.optionsOrUseCapture)
        );
      }
    e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(u) {
      typeof u.rootMargin == "string" ? RS(
        t,
        u,
        e
      ) : u.unobserve(e);
    }), e.reactFragments != null && e.reactFragments.delete(t));
  }
  function tm(e) {
    var t = e.firstChild;
    for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
      var n = t;
      switch (t = t.nextSibling, n.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          tm(n), hi(n);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (n.rel.toLowerCase() === "stylesheet") continue;
      }
      e.removeChild(n);
    }
  }
  function MS(e, t, n, a) {
    for (; e.nodeType === 1; ) {
      var o = n;
      if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
        if (!a && (e.nodeName !== "INPUT" || e.type !== "hidden"))
          break;
      } else if (a) {
        if (!e[Ft])
          switch (t) {
            case "meta":
              if (!e.hasAttribute("itemprop")) break;
              return e;
            case "link":
              if (u = e.getAttribute("rel"), u === "stylesheet" && e.hasAttribute("data-precedence"))
                break;
              if (u !== o.rel || e.getAttribute("href") !== (o.href == null || o.href === "" ? null : o.href) || e.getAttribute("crossorigin") !== (o.crossOrigin == null ? null : o.crossOrigin) || e.getAttribute("title") !== (o.title == null ? null : o.title))
                break;
              return e;
            case "style":
              if (e.hasAttribute("data-precedence")) break;
              return e;
            case "script":
              if (u = e.getAttribute("src"), (u !== (o.src == null ? null : o.src) || e.getAttribute("type") !== (o.type == null ? null : o.type) || e.getAttribute("crossorigin") !== (o.crossOrigin == null ? null : o.crossOrigin)) && u && e.hasAttribute("async") && !e.hasAttribute("itemprop"))
                break;
              return e;
            default:
              return e;
          }
      } else if (t === "input" && e.type === "hidden") {
        var u = o.name == null ? null : "" + o.name;
        if (o.type === "hidden" && e.getAttribute("name") === u)
          return e;
      } else return e;
      if (e = Fl(e.nextSibling), e === null) break;
    }
    return null;
  }
  function NS(e, t, n) {
    if (t === "") return null;
    for (; e.nodeType !== 3; )
      if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = Fl(e.nextSibling), e === null)) return null;
    return e;
  }
  function hv(e, t) {
    for (; e.nodeType !== 8; )
      if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = Fl(e.nextSibling), e === null)) return null;
    return e;
  }
  function nm(e) {
    return e.data === "$?" || e.data === "$~";
  }
  function lm(e) {
    return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
  }
  function DS(e, t) {
    var n = e.ownerDocument;
    if (e.data === "$~") e._reactRetry = t;
    else if (e.data !== "$?" || n.readyState !== "loading")
      t();
    else {
      var a = function() {
        t(), n.removeEventListener("DOMContentLoaded", a);
      };
      n.addEventListener("DOMContentLoaded", a), e._reactRetry = a;
    }
  }
  function Fl(e) {
    for (; e != null; e = e.nextSibling) {
      var t = e.nodeType;
      if (t === 1 || t === 3) break;
      if (t === 8) {
        if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F")
          break;
        if (t === "/$" || t === "/&") return null;
      }
    }
    return e;
  }
  var am = null;
  function pv(e) {
    e = e.nextSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var n = e.data;
        if (n === "/$" || n === "/&") {
          if (t === 0)
            return Fl(e.nextSibling);
          t--;
        } else
          n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
      }
      e = e.nextSibling;
    }
    return null;
  }
  function vv(e) {
    e = e.previousSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var n = e.data;
        if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
          if (t === 0) return e;
          t--;
        } else n !== "/$" && n !== "/&" || t++;
      }
      e = e.previousSibling;
    }
    return null;
  }
  function zS(e, t) {
    function n() {
      a = !0;
    }
    if (e.ownerDocument.activeElement === e) return !0;
    var a = !1;
    try {
      e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
    } finally {
      e.ownerDocument.removeEventListener("focus", n, !0);
    }
    return a;
  }
  function _S(e) {
    lv(function() {
      lv(function(t) {
        return e(t);
      });
    });
  }
  function bv(e, t, n) {
    switch (t = ou(n), e) {
      case "html":
        if (e = t.documentElement, !e) throw Error(s(452));
        return e;
      case "head":
        if (e = t.head, !e) throw Error(s(453));
        return e;
      case "body":
        if (e = t.body, !e) throw Error(s(454));
        return e;
      default:
        throw Error(s(451));
    }
  }
  function yv(e, t, n) {
    for (var a in n) {
      var o = n[a];
      n.hasOwnProperty(a) && o != null && Vt(e, t, a, null, uS, o);
    }
    n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === In && (e.onclick = null), hi(e);
  }
  function im(e) {
    for (var t = e.attributes; t.length; )
      e.removeAttributeNode(t[0]);
    hi(e);
  }
  var Jl = /* @__PURE__ */ new Map(), xv = /* @__PURE__ */ new Set();
  function ru(e) {
    if (typeof e.getRootNode == "function") {
      var t = e.getRootNode();
      if (t.nodeType === 9 || t.nodeType === 11) return t;
    }
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  var ai = xe.d;
  xe.d = {
    f: jS,
    r: HS,
    D: US,
    C: IS,
    L: VS,
    m: LS,
    X: qS,
    S: BS,
    M: GS
  };
  function jS() {
    var e = ai.f(), t = Ms();
    return e || t;
  }
  function HS(e) {
    var t = Ba(e);
    t !== null && t.tag === 5 && t.type === "form" ? Eh(t) : ai.r(e);
  }
  var sr = typeof document > "u" ? null : document;
  function Sv(e, t, n) {
    var a = sr;
    if (a && typeof t == "string" && t) {
      var o = qt(t);
      o = 'link[rel="' + e + '"][href="' + o + '"]', typeof n == "string" && (o += '[crossorigin="' + n + '"]'), xv.has(o) || (xv.add(o), e = { rel: e, crossOrigin: n, href: t }, a.querySelector(o) === null && (t = a.createElement("link"), Fn(t, "link", e), me(t), a.head.appendChild(t)));
    }
  }
  function US(e) {
    ai.D(e), Sv("dns-prefetch", e, null);
  }
  function IS(e, t) {
    ai.C(e, t), Sv("preconnect", e, t);
  }
  function VS(e, t, n) {
    ai.L(e, t, n);
    var a = sr;
    if (a && e && t) {
      var o = 'link[rel="preload"][as="' + qt(t) + '"]';
      t === "image" && n && n.imageSrcSet ? (o += '[imagesrcset="' + qt(
        n.imageSrcSet
      ) + '"]', typeof n.imageSizes == "string" && (o += '[imagesizes="' + qt(
        n.imageSizes
      ) + '"]')) : o += '[href="' + qt(e) + '"]';
      var u = o;
      switch (t) {
        case "style":
          u = cr(e);
          break;
        case "script":
          u = fr(e);
      }
      if (!(Jl.has(u) || (e = _(
        {
          rel: "preload",
          href: t === "image" && n && n.imageSrcSet ? void 0 : e,
          as: t
        },
        n
      ), Jl.set(u, e), a.querySelector(o) !== null || t === "style" && a.querySelector(uu(u)) || t === "script" && a.querySelector(su(u))))) {
        var d = a.createElement("link");
        Fn(d, "link", e), t === "style" && (d[Hn] = !0, d.onload = d.onerror = function() {
          Be(d);
        }), me(d), a.head.appendChild(d);
      }
    }
  }
  function LS(e, t) {
    ai.m(e, t);
    var n = sr;
    if (n && e) {
      var a = t && typeof t.as == "string" ? t.as : "script", o = 'link[rel="modulepreload"][as="' + qt(a) + '"][href="' + qt(e) + '"]', u = o;
      switch (a) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          u = fr(e);
      }
      if (!Jl.has(u) && (e = _({ rel: "modulepreload", href: e }, t), Jl.set(u, e), n.querySelector(o) === null)) {
        switch (a) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (n.querySelector(su(u)))
              return;
        }
        a = n.createElement("link"), Fn(a, "link", e), me(a), n.head.appendChild(a);
      }
    }
  }
  function BS(e, t, n) {
    ai.S(e, t, n);
    var a = sr;
    if (a && e) {
      var o = fe(a).hoistableStyles, u = cr(e);
      t = t || "default";
      var d = o.get(u);
      if (!d) {
        var S = { loading: 0, preload: null };
        if (d = a.querySelector(
          uu(u)
        ))
          S.loading = 5;
        else {
          e = _(
            { rel: "stylesheet", href: e, "data-precedence": t },
            n
          ), (n = Jl.get(u)) && om(e, n);
          var D = d = a.createElement("link");
          me(D), Fn(D, "link", e), D._p = new Promise(function(K, ee) {
            D.onload = K, D.onerror = ee;
          }), D.addEventListener("load", function() {
            S.loading |= 1;
          }), D.addEventListener("error", function() {
            S.loading |= 2;
          }), S.loading |= 4, Us(d, t, a);
        }
        d = {
          type: "stylesheet",
          instance: d,
          count: 1,
          state: S
        }, o.set(u, d);
      }
    }
  }
  function qS(e, t) {
    ai.X(e, t);
    var n = sr;
    if (n && e) {
      var a = fe(n).hoistableScripts, o = fr(e), u = a.get(o);
      u || (u = n.querySelector(su(o)), u || (e = _({ src: e, async: !0 }, t), (t = Jl.get(o)) && rm(e, t), u = n.createElement("script"), me(u), Fn(u, "link", e), n.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, a.set(o, u));
    }
  }
  function GS(e, t) {
    ai.M(e, t);
    var n = sr;
    if (n && e) {
      var a = fe(n).hoistableScripts, o = fr(e), u = a.get(o);
      u || (u = n.querySelector(su(o)), u || (e = _({ src: e, async: !0, type: "module" }, t), (t = Jl.get(o)) && rm(e, t), u = n.createElement("script"), me(u), Fn(u, "link", e), n.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, a.set(o, u));
    }
  }
  function Ev(e, t, n, a) {
    var o = (o = re.current) ? ru(o) : null;
    if (!o) throw Error(s(446));
    switch (e) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof n.precedence == "string" && typeof n.href == "string" ? (n = cr(n.href), t = fe(
          o
        ).hoistableStyles, a = t.get(n), a || (a = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, t.set(n, a)), a) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
          e = cr(n.href);
          var u = fe(
            o
          ).hoistableStyles, d = u.get(e);
          if (d || (o = o.ownerDocument || o, d = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, u.set(e, d), (u = o.querySelector(
            uu(e)
          )) ? u._p || (d.instance = u, d.state.loading = 5) : (u = Jl.get(e), u || (u = {
            rel: "preload",
            as: "style",
            href: n.href,
            crossOrigin: n.crossOrigin,
            integrity: n.integrity,
            media: n.media,
            hrefLang: n.hrefLang,
            referrerPolicy: n.referrerPolicy
          }, Jl.set(e, u)), YS(
            o,
            e,
            u,
            d.state
          ))), t && a === null)
            throw Error(s(528, ""));
          return d;
        }
        if (t && a !== null)
          throw Error(s(529, ""));
        return null;
      case "script":
        return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = fr(n), t = fe(
          o
        ).hoistableScripts, a = t.get(n), a || (a = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, t.set(n, a)), a) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(s(444, e));
    }
  }
  function cr(e) {
    return 'href="' + qt(e) + '"';
  }
  function uu(e) {
    return 'link[rel="stylesheet"][' + e + "]";
  }
  function Cv(e) {
    return _({}, e, {
      "data-precedence": e.precedence,
      precedence: null
    });
  }
  function YS(e, t, n, a) {
    if (t = e.querySelector(
      'link[rel="preload"][as="style"][' + t + "]"
    )) {
      if (t[Hn] !== !0) {
        a.loading = 1;
        return;
      }
    } else
      t = e.createElement("link"), t[Hn] = !0, t.onload = t.onerror = Be.bind(null, t), Fn(t, "link", n), me(t), e.head.appendChild(t);
    a.preload = t, t.addEventListener("load", function() {
      return a.loading |= 1;
    }), t.addEventListener("error", function() {
      return a.loading |= 2;
    });
  }
  function fr(e) {
    return '[src="' + qt(e) + '"]';
  }
  function su(e) {
    return "script[async]" + e;
  }
  function Rv(e, t, n) {
    if (t.count++, t.instance === null)
      switch (t.type) {
        case "style":
          var a = e.querySelector(
            'style[data-href~="' + qt(n.href) + '"]'
          );
          if (a)
            return t.instance = a, me(a), a;
          var o = _({}, n, {
            "data-href": n.href,
            "data-precedence": n.precedence,
            href: null,
            precedence: null
          });
          return a = (e.ownerDocument || e).createElement(
            "style"
          ), me(a), Fn(a, "style", o), Us(a, n.precedence, e), t.instance = a;
        case "stylesheet":
          o = cr(n.href);
          var u = e.querySelector(
            uu(o)
          );
          if (u)
            return t.state.loading |= 4, t.instance = u, me(u), u;
          a = Cv(n), (o = Jl.get(o)) && om(a, o), u = (e.ownerDocument || e).createElement("link"), me(u);
          var d = u;
          return d._p = new Promise(function(S, D) {
            d.onload = S, d.onerror = D;
          }), Fn(u, "link", a), t.state.loading |= 4, Us(u, n.precedence, e), t.instance = u;
        case "script":
          return u = fr(n.src), (o = e.querySelector(
            su(u)
          )) ? (t.instance = o, me(o), o) : (a = n, (o = Jl.get(u)) && (a = _({}, n), rm(a, o)), e = e.ownerDocument || e, o = e.createElement("script"), me(o), Fn(o, "link", a), e.head.appendChild(o), t.instance = o);
        case "void":
          return null;
        default:
          throw Error(s(443, t.type));
      }
    else
      t.type === "stylesheet" && (t.state.loading & 4) === 0 && (a = t.instance, t.state.loading |= 4, Us(a, n.precedence, e));
    return t.instance;
  }
  function Us(e, t, n) {
    for (var a = n.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), o = a.length ? a[a.length - 1] : null, u = o, d = 0; d < a.length; d++) {
      var S = a[d];
      if (S.dataset.precedence === t) u = S;
      else if (u !== o) break;
    }
    u ? u.parentNode.insertBefore(e, u.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
  }
  function om(e, t) {
    e.crossOrigin == null && (e.crossOrigin = t.crossOrigin), e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy), e.title == null && (e.title = t.title);
  }
  function rm(e, t) {
    e.crossOrigin == null && (e.crossOrigin = t.crossOrigin), e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy), e.integrity == null && (e.integrity = t.integrity);
  }
  var Is = null;
  function Tv(e, t, n) {
    if (Is === null) {
      var a = /* @__PURE__ */ new Map(), o = Is = /* @__PURE__ */ new Map();
      o.set(n, a);
    } else
      o = Is, a = o.get(n), a || (a = /* @__PURE__ */ new Map(), o.set(n, a));
    if (a.has(e)) return a;
    for (a.set(e, null), n = n.getElementsByTagName(e), o = 0; o < n.length; o++) {
      var u = n[o];
      if (!(u[Ft] || u[Xt] || e === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
        var d = u.getAttribute(t) || "";
        d = e + d;
        var S = a.get(d);
        S ? S.push(u) : a.set(d, [u]);
      }
    }
    return a;
  }
  function um(e, t, n) {
    e = e.ownerDocument || e, e.head.insertBefore(
      n,
      t === "title" ? e.querySelector("head > title") : null
    );
  }
  function kS(e, t, n) {
    if (n === 1 || t.itemProp != null) return !1;
    switch (e) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "")
          break;
        return !0;
      case "link":
        if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError)
          break;
        return t.rel === "stylesheet" ? (e = t.disabled, typeof t.precedence == "string" && e == null) : !0;
      case "script":
        if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string")
          return !0;
    }
    return !1;
  }
  function Av(e, t) {
    return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
  }
  function Ov(e) {
    return !(e.type === "stylesheet" && (e.state.loading & 3) === 0);
  }
  function wv(e) {
    return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * 0.25;
  }
  function Mv(e, t) {
    typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += wv(t), e.suspenseyImages.push(t)), e = PS.bind(e), t.decode().then(e, e));
  }
  function XS(e, t, n, a) {
    if (n.type === "stylesheet" && (typeof a.media != "string" || matchMedia(a.media).matches !== !1) && (n.state.loading & 4) === 0) {
      if (n.instance === null) {
        var o = cr(a.href), u = t.querySelector(
          uu(o)
        );
        if (u) {
          t = u._p, t !== null && typeof t == "object" && typeof t.then == "function" && (e.count++, e = cu.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = u, me(u);
          return;
        }
        u = t.ownerDocument || t, a = Cv(a), (o = Jl.get(o)) && om(a, o), u = u.createElement("link"), me(u);
        var d = u;
        d._p = new Promise(function(S, D) {
          d.onload = S, d.onerror = D;
        }), Fn(u, "link", a), n.instance = u;
      }
      e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && (n.state.loading & 3) === 0 && (e.count++, n = cu.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
    }
  }
  var Vs = 0;
  function KS(e, t) {
    return e.stylesheets && e.count === 0 && Bs(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
      var a = setTimeout(function() {
        if (e.stylesheets && Bs(e, e.stylesheets), e.unsuspend) {
          var u = e.unsuspend;
          e.unsuspend = null, u();
        }
      }, 6e4 + t);
      0 < e.imgBytes && Vs === 0 && (Vs = 62500 * cS());
      var o = setTimeout(
        function() {
          if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && Bs(e, e.stylesheets), e.unsuspend)) {
            var u = e.unsuspend;
            e.unsuspend = null, u();
          }
        },
        (e.imgBytes > Vs ? 50 : 800) + t
      );
      return e.unsuspend = n, function() {
        e.unsuspend = null, clearTimeout(a), clearTimeout(o);
      };
    } : null;
  }
  function Nv(e) {
    if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
      if (e.stylesheets) Bs(e, e.stylesheets);
      else if (e.unsuspend) {
        var t = e.unsuspend;
        e.unsuspend = null, t();
      }
    }
  }
  function cu() {
    this.count--, Nv(this);
  }
  function PS() {
    this.imgCount--, Nv(this);
  }
  var Ls = null;
  function Bs(e, t) {
    e.stylesheets = null, e.unsuspend !== null && (e.count++, Ls = /* @__PURE__ */ new Map(), t.forEach(QS, e), Ls = null, cu.call(e));
  }
  function QS(e, t) {
    if (!(t.state.loading & 4)) {
      var n = Ls.get(e);
      if (n) var a = n.get(null);
      else {
        n = /* @__PURE__ */ new Map(), Ls.set(e, n);
        for (var o = e.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), u = 0; u < o.length; u++) {
          var d = o[u];
          (d.nodeName === "LINK" || d.getAttribute("media") !== "not all") && (n.set(d.dataset.precedence, d), a = d);
        }
        a && n.set(null, a);
      }
      o = t.instance, d = o.getAttribute("data-precedence"), u = n.get(d) || a, u === a && n.set(null, o), n.set(d, o), this.count++, a = cu.bind(this), o.addEventListener("load", a), o.addEventListener("error", a), u ? u.parentNode.insertBefore(o, u.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(o, e.firstChild)), t.state.loading |= 4;
    }
  }
  var dr = {
    $$typeof: le,
    Provider: null,
    Consumer: null,
    _currentValue: Ke,
    _currentValue2: Ke,
    _threadCount: 0
  };
  function ZS(e, t, n, a, o, u, d, S, D) {
    this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Ia(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Ia(0), this.hiddenUpdates = Ia(null), this.identifierPrefix = a, this.onUncaughtError = o, this.onCaughtError = u, this.onRecoverableError = d, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = D, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function Dv(e, t, n, a, o, u, d, S, D, K, ee, se) {
    return e = new ZS(
      e,
      t,
      n,
      d,
      D,
      K,
      ee,
      se,
      S
    ), t = 1, u === !0 && (t |= 24), u = El(3, null, null, t), e.current = u, u.stateNode = e, t = Cf(), t.refCount++, e.pooledCache = t, t.refCount++, u.memoizedState = {
      element: a,
      isDehydrated: n,
      cache: t
    }, Of(u), e;
  }
  function zv(e) {
    return e ? (e = Vo, e) : Vo;
  }
  function _v(e, t, n, a, o, u) {
    o = zv(o), a.context === null ? a.context = o : a.pendingContext = o, a = Ri(t), a.payload = { element: n }, u = u === void 0 ? null : u, u !== null && (a.callback = u), n = Ti(e, a, t), n !== null && (Al(n, e, t), qr(n, e, t));
  }
  function jv(e, t) {
    if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
      var n = e.retryLane;
      e.retryLane = n !== 0 && n < t ? n : t;
    }
  }
  function sm(e, t) {
    jv(e, t), (e = e.alternate) && jv(e, t);
  }
  function Hv(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = to(e, 67108864);
      t !== null && Al(t, e, 67108864), sm(e, 67108864);
    }
  }
  function Uv(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = Ul();
      t = Ie(t);
      var n = to(e, t);
      n !== null && Al(n, e, t), sm(e, t);
    }
  }
  var mr = !0;
  function FS(e, t, n, a) {
    var o = pe.T;
    pe.T = null;
    var u = xe.p;
    try {
      xe.p = 2, cm(e, t, n, a);
    } finally {
      xe.p = u, pe.T = o;
    }
  }
  function JS(e, t, n, a) {
    var o = pe.T;
    pe.T = null;
    var u = xe.p;
    try {
      xe.p = 8, cm(e, t, n, a);
    } finally {
      xe.p = u, pe.T = o;
    }
  }
  function cm(e, t, n, a) {
    if (mr) {
      var o = fm(a);
      if (o === null)
        Xd(
          e,
          t,
          a,
          qs,
          n
        ), Vv(e, a);
      else if (WS(
        o,
        e,
        t,
        n,
        a
      ))
        a.stopPropagation();
      else if (Vv(e, a), t & 4 && -1 < $S.indexOf(e)) {
        for (; o !== null; ) {
          var u = Ba(o);
          if (u !== null)
            switch (u.tag) {
              case 3:
                if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                  var d = nl(u.pendingLanes);
                  if (d !== 0) {
                    var S = u;
                    for (S.pendingLanes |= 2, S.entangledLanes |= 2; d; ) {
                      var D = 1 << 31 - pt(d);
                      S.entanglements[1] |= D, d &= ~D;
                    }
                    wa(u), (Dt & 6) === 0 && (As = Zt() + 500, lu(0));
                  }
                }
                break;
              case 31:
              case 13:
                S = to(u, 2), S !== null && Al(S, u, 2), Ms(), sm(u, 2);
            }
          if (u = fm(a), u === null && Xd(
            e,
            t,
            a,
            qs,
            n
          ), u === o) break;
          o = u;
        }
        o !== null && a.stopPropagation();
      } else
        Xd(
          e,
          t,
          a,
          null,
          n
        );
    }
  }
  function fm(e) {
    return e = ka(e), dm(e);
  }
  var qs = null;
  function dm(e) {
    if (qs = null, e = Sl(e), e !== null) {
      var t = f(e);
      if (t === null) e = null;
      else {
        var n = t.tag;
        if (n === 13) {
          if (e = m(t), e !== null) return e;
          e = null;
        } else if (n === 31) {
          if (e = v(t), e !== null) return e;
          e = null;
        } else if (n === 3) {
          if (t.stateNode.current.memoizedState.isDehydrated)
            return t.tag === 3 ? t.stateNode.containerInfo : null;
          e = null;
        } else t !== e && (e = null);
      }
    }
    return qs = e, null;
  }
  function Iv(e) {
    switch (e) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "fullscreenerror":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "resize":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (tl()) {
          case Tn:
            return 2;
          case $t:
            return 8;
          case Bt:
          case ma:
            return 32;
          case en:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var mm = !1, Ii = null, Vi = null, Li = null, fu = /* @__PURE__ */ new Map(), du = /* @__PURE__ */ new Map(), Bi = [], $S = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function Vv(e, t) {
    switch (e) {
      case "focusin":
      case "focusout":
        Ii = null;
        break;
      case "dragenter":
      case "dragleave":
        Vi = null;
        break;
      case "mouseover":
      case "mouseout":
        Li = null;
        break;
      case "pointerover":
      case "pointerout":
        fu.delete(t.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        du.delete(t.pointerId);
    }
  }
  function mu(e, t, n, a, o, u) {
    return e === null || e.nativeEvent !== u ? (e = {
      blockedOn: t,
      domEventName: n,
      eventSystemFlags: a,
      nativeEvent: u,
      targetContainers: [o]
    }, t !== null && (t = Ba(t), t !== null && Hv(t)), e) : (e.eventSystemFlags |= a, t = e.targetContainers, o !== null && t.indexOf(o) === -1 && t.push(o), e);
  }
  function WS(e, t, n, a, o) {
    switch (t) {
      case "focusin":
        return Ii = mu(
          Ii,
          e,
          t,
          n,
          a,
          o
        ), !0;
      case "dragenter":
        return Vi = mu(
          Vi,
          e,
          t,
          n,
          a,
          o
        ), !0;
      case "mouseover":
        return Li = mu(
          Li,
          e,
          t,
          n,
          a,
          o
        ), !0;
      case "pointerover":
        var u = o.pointerId;
        return fu.set(
          u,
          mu(
            fu.get(u) || null,
            e,
            t,
            n,
            a,
            o
          )
        ), !0;
      case "gotpointercapture":
        return u = o.pointerId, du.set(
          u,
          mu(
            du.get(u) || null,
            e,
            t,
            n,
            a,
            o
          )
        ), !0;
    }
    return !1;
  }
  function Lv(e) {
    var t = Sl(e.target);
    if (t !== null) {
      var n = f(t);
      if (n !== null) {
        if (t = n.tag, t === 13) {
          if (t = m(n), t !== null) {
            e.blockedOn = t, La(e.priority, function() {
              Uv(n);
            });
            return;
          }
        } else if (t === 31) {
          if (t = v(n), t !== null) {
            e.blockedOn = t, La(e.priority, function() {
              Uv(n);
            });
            return;
          }
        } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
          e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
          return;
        }
      }
    }
    e.blockedOn = null;
  }
  function Gs(e) {
    if (e.blockedOn !== null) return !1;
    for (var t = e.targetContainers; 0 < t.length; ) {
      var n = fm(e.nativeEvent);
      if (n === null) {
        n = e.nativeEvent;
        var a = new n.constructor(
          n.type,
          n
        );
        Ya = a, n.target.dispatchEvent(a), Ya = null;
      } else
        return t = Ba(n), t !== null && Hv(t), e.blockedOn = n, !1;
      t.shift();
    }
    return !0;
  }
  function Bv(e, t, n) {
    Gs(e) && n.delete(t);
  }
  function eE() {
    mm = !1, Ii !== null && Gs(Ii) && (Ii = null), Vi !== null && Gs(Vi) && (Vi = null), Li !== null && Gs(Li) && (Li = null), fu.forEach(Bv), du.forEach(Bv);
  }
  function Ys(e, t) {
    e.blockedOn === t && (e.blockedOn = null, mm || (mm = !0, l.unstable_scheduleCallback(
      l.unstable_NormalPriority,
      eE
    )));
  }
  var ks = null;
  function qv(e) {
    ks !== e && (ks = e, l.unstable_scheduleCallback(
      l.unstable_NormalPriority,
      function() {
        ks === e && (ks = null);
        for (var t = 0; t < e.length; t += 3) {
          var n = e[t], a = e[t + 1], o = e[t + 2];
          if (typeof a != "function") {
            if (dm(a || n) === null)
              continue;
            break;
          }
          var u = Ba(n);
          u !== null && (e.splice(t, 3), t -= 3, Qf(
            u,
            {
              pending: !0,
              data: o,
              method: n.method,
              action: a
            },
            a,
            o
          ));
        }
      }
    ));
  }
  function gr(e) {
    function t(D) {
      return Ys(D, e);
    }
    Ii !== null && Ys(Ii, e), Vi !== null && Ys(Vi, e), Li !== null && Ys(Li, e), fu.forEach(t), du.forEach(t);
    for (var n = 0; n < Bi.length; n++) {
      var a = Bi[n];
      a.blockedOn === e && (a.blockedOn = null);
    }
    for (; 0 < Bi.length && (n = Bi[0], n.blockedOn === null); )
      Lv(n), n.blockedOn === null && Bi.shift();
    if (n = (e.ownerDocument || e).$$reactFormReplay, n != null)
      for (a = 0; a < n.length; a += 3) {
        var o = n[a], u = n[a + 1], d = o[Mn] || null;
        if (typeof u == "function")
          d || qv(n);
        else if (d) {
          var S = null;
          if (u && u.hasAttribute("formAction")) {
            if (o = u, d = u[Mn] || null)
              S = d.formAction;
            else if (dm(o) !== null) continue;
          } else S = d.action;
          typeof S == "function" ? n[a + 1] = S : (n.splice(a, 3), a -= 3), qv(n);
        }
      }
  }
  function Gv() {
    function e(u) {
      u.canIntercept && u.info === "react-transition" && u.intercept({
        handler: function() {
          return new Promise(function(d) {
            return o = d;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function t() {
      o !== null && (o(), o = null), a || setTimeout(n, 20);
    }
    function n() {
      if (!a && !navigation.transition) {
        var u = navigation.currentEntry;
        u && u.url != null && navigation.navigate(u.url, {
          state: u.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var a = !1, o = null;
      return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
        a = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), o !== null && (o(), o = null);
      };
    }
  }
  function gm(e) {
    this._internalRoot = e;
  }
  Xs.prototype.render = gm.prototype.render = function(e) {
    var t = this._internalRoot;
    if (t === null) throw Error(s(409));
    var n = t.current, a = Ul();
    _v(n, a, e, t, null, null);
  }, Xs.prototype.unmount = gm.prototype.unmount = function() {
    var e = this._internalRoot;
    if (e !== null) {
      this._internalRoot = null;
      var t = e.containerInfo;
      _v(e.current, 2, null, e, null, null), Ms(), t[jn] = null;
    }
  };
  function Xs(e) {
    this._internalRoot = e;
  }
  Xs.prototype.unstable_scheduleHydration = function(e) {
    if (e) {
      var t = xl();
      e = { blockedOn: null, target: e, priority: t };
      for (var n = 0; n < Bi.length && t !== 0 && t < Bi[n].priority; n++) ;
      Bi.splice(n, 0, e), n === 0 && Lv(e);
    }
  };
  var Yv = i.version;
  if (Yv !== "19.3.0")
    throw Error(
      s(
        527,
        Yv,
        "19.3.0"
      )
    );
  xe.findDOMNode = function(e) {
    var t = e._reactInternals;
    if (t === void 0)
      throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
    return e = h(t), e = e !== null ? p(e) : null, e = e === null ? null : e.stateNode, e;
  };
  var tE = {
    bundleType: 0,
    version: "19.3.0",
    rendererPackageName: "react-dom",
    currentDispatcherRef: pe,
    reconcilerVersion: "19.3.0"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var Ks = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!Ks.isDisabled && Ks.supportsFiber)
      try {
        Ot = Ks.inject(
          tE
        ), dt = Ks;
      } catch {
      }
  }
  return hu.createRoot = function(e, t) {
    if (!c(e)) throw Error(s(299));
    var n = !1, a = "", o = zh, u = _h, d = jh;
    return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (a = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (u = t.onCaughtError), t.onRecoverableError !== void 0 && (d = t.onRecoverableError)), t = Dv(
      e,
      1,
      !1,
      null,
      null,
      n,
      a,
      null,
      o,
      u,
      d,
      Gv
    ), e[jn] = t.current, kd(e), new gm(t);
  }, hu.hydrateRoot = function(e, t, n) {
    if (!c(e)) throw Error(s(299));
    var a = !1, o = "", u = zh, d = _h, S = jh, D = null;
    return n != null && (n.unstable_strictMode === !0 && (a = !0), n.identifierPrefix !== void 0 && (o = n.identifierPrefix), n.onUncaughtError !== void 0 && (u = n.onUncaughtError), n.onCaughtError !== void 0 && (d = n.onCaughtError), n.onRecoverableError !== void 0 && (S = n.onRecoverableError), n.formState !== void 0 && (D = n.formState)), t = Dv(
      e,
      1,
      !0,
      t,
      n ?? null,
      a,
      o,
      D,
      u,
      d,
      S,
      Gv
    ), t.context = zv(null), n = t.current, a = Ul(), a = Ie(a), o = Ri(a), o.callback = null, Ti(n, o, a), n = a, t.current.lanes = n, ll(t, n), wa(t), e[jn] = t.current, kd(e), new Xs(t);
  }, hu.version = "19.3.0", hu;
}
var Wv;
function xE() {
  if (Wv) return vm.exports;
  Wv = 1;
  function l() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(l);
      } catch (i) {
        console.error(i);
      }
  }
  return l(), vm.exports = yE(), vm.exports;
}
var SE = xE(), zo = cy();
const fy = 48, Ha = (l, i = 0) => {
  const r = new Int32Array(l.length);
  for (let s = 0; s < l.length; s++) r[s] = l.charCodeAt(s) - fy - i;
  return r;
}, Oc = (l) => {
  const i = new Int32Array(l.length + 1);
  for (let r = 0; r < l.length; r++) i[r + 1] = i[r] + l[r];
  return i;
}, Xi = (l) => {
  const i = new Int32Array(l.length);
  let r = 0;
  for (let s = 0; s < l.length; s++) {
    const c = l.charCodeAt(s) - fy;
    r += c >>> 1 ^ -(c & 1), i[s] = r;
  }
  return i;
}, EE = 384, CE = [], Co = Oc(Ha("E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010")), RE = Oc(Ha(":11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3")), TE = "@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom", AE = (() => {
  const l = Co.length - 1, i = new Int32Array(l);
  for (let c = l - 1; c >= 0; c--) {
    let f = 1, m = c + 1;
    for (let v = Co[c]; v < Co[c + 1]; v++)
      f += i[m], m += i[m];
    i[c] = f;
  }
  const r = new Int32Array(Co[l]);
  let s = 0;
  for (let c = 0; c < l; c++) {
    let f = c + 1;
    for (let m = Co[c]; m < Co[c + 1]; m++)
      r[s++] = f, f += i[f];
  }
  return r;
})(), OE = Ha("02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000", 1), wE = Oc(Ha("123333359346463635126536711576")), ME = Ha("93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032"), NE = Ha("012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199"), DE = Xi("020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200"), zE = (() => {
  const l = (/* @__PURE__ */ new Int32Array(319)).fill(-1), i = Xi("02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222"), r = Xi("02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222");
  for (let s = 0; s < i.length; s++) l[i[s]] = r[s];
  return l;
})(), _E = "container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover| gradient-to-b gradient-to-bl gradient-to-br gradient-to-l gradient-to-r gradient-to-t gradient-to-tl gradient-to-tr none|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform".split("|").map((l) => {
  const i = l.split(" "), r = i.shift();
  for (let s = 0; s < i.length; s++) i[s] = r + i[s];
  return i;
}), eb = Xi("0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422"), jE = Xi("ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>ʶ22ʷʺʷ2ʸʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622"), HE = Xi("02222222222222222222222222222222222222222222222222222222222222222202022222222222EH2200IL021042222Y\\222IL0cf2e10j2222U00X202[^2y0000120|{~22:22|22222222222G000qOVI00000}2>40000B00000I¨©000¬00000000000000021M®­00°000000000000000000000222HGHa1º222¿2À2222ÉÌ000­°2±"), dy = /* @__PURE__ */ new Int32Array(995), my = /* @__PURE__ */ new Int32Array(995), gy = /* @__PURE__ */ new Int32Array(995);
let qm = "";
const Gm = /* @__PURE__ */ new Int32Array(1038);
{
  const l = /* @__PURE__ */ new Map();
  let i = 0, r = 0;
  for (let s = 0; s < eb.length; s++) for (const c of _E[HE[s]]) {
    let f = l.get(c);
    f === void 0 && (f = i++, l.set(c, f), Gm[f * 2] = qm.length, Gm[f * 2 + 1] = c.length, qm += c), dy[r] = eb[s], my[r] = jE[s], gy[r] = f, r++;
  }
}
const UE = Xi("0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p"), IE = Oc(Ha("1::24444432:442:44:44>222222:44:4421322511111311111114")), VE = Xi("24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222"), LE = Ha("ĳ"), BE = Ha(""), qE = Ha("1"), GE = "* ** after backdrop before details-content file first-letter first-line marker placeholder selection";
var YE = {
  GROUP_COUNT: EE,
  customValidatorNames: CE,
  edgeStart: Co,
  labelStart: RE,
  labelText: TE,
  edgeTarget: AE,
  nodeGroup: OE,
  nodeVlist: zE,
  vlistPat: wE,
  vlistOps: ME,
  vlistRef: NE,
  vlistGroup: DE,
  litAnchor: dy,
  litGroup: my,
  litPool: gy,
  poolOffsets: Gm,
  poolText: qm,
  adjGid: UE,
  adjStart: IE,
  adjTgt: VE,
  patGid: LE,
  patTgt: BE,
  postfixLookupGroups: qE,
  orderSensitiveModifiers: GE
};
const kE = "line" in /* @__PURE__ */ new Error(), Ma = -1, xo = -1, Sm = (l, i, r) => {
  let s = 2166136261;
  for (let c = i; c < r; c++) s = Math.imul(s ^ l.charCodeAt(c), 16777619);
  return s;
}, ac = (l, i, r) => {
  const s = r - i;
  let c = Math.imul(s, 2654435761) ^ l.charCodeAt(i);
  if (s > 3) {
    const f = s >> 2, m = s >> 1;
    c = Math.imul(c ^ l.charCodeAt(i + 1) << 8 ^ l.charCodeAt(i + 2) << 16 ^ l.charCodeAt(i + f), 2246822507), c = Math.imul(c ^ l.charCodeAt(i + m) << 8 ^ l.charCodeAt(i + m + f) << 16 ^ l.charCodeAt(r - 3), 3266489909), c ^= l.charCodeAt(r - 2) << 8 ^ l.charCodeAt(r - 1) << 16;
    for (let v = i + 3, y = r - 4; v < i + 8 && v < y; v++, y--) c = Math.imul(c ^ l.charCodeAt(v) ^ l.charCodeAt(y) << 8, 16777619);
  }
  return c ^ c >>> 15 | 0;
}, XE = (l, i, r = {}) => {
  const { GROUP_COUNT: s, edgeStart: c, labelStart: f, labelText: m, edgeTarget: v, nodeGroup: y, nodeVlist: h, vlistPat: p, vlistOps: g, vlistRef: x, vlistGroup: T, litAnchor: A, litGroup: N, litPool: E, poolOffsets: M, poolText: R, adjGid: I, adjStart: C, adjTgt: z, patGid: V, patTgt: _, postfixLookupGroups: U, customValidatorNames: j, orderSensitiveModifiers: H } = l, q = new Int32Array(s).fill(-1);
  for (let W = 0; W < I.length; W++) q[I[W]] = W;
  let $ = 0;
  for (let W = 0; W + 1 < C.length; W++) {
    const fe = C[W + 1] - C[W];
    fe > $ && ($ = fe);
  }
  let Z = 32;
  for (; Z < 2 * (1 + $ + V.length); ) Z <<= 1;
  const G = new Int32Array(x.length + 1);
  for (let W = 0; W < x.length; W++) G[W + 1] = G[W] + p[x[W] + 1] - p[x[W]];
  const le = new Uint8Array(s);
  for (let W = 0; W < U.length; W++) le[U[W]] = 1;
  const k = c.length - 1, ie = new Uint8Array(k);
  let P = 0, J = !0;
  for (let W = 0; W < A.length; W++) {
    ie[A[W]] = 1;
    const fe = M[E[W] * 2 + 1];
    fe > P && (P = fe);
    const me = R.charCodeAt(M[E[W] * 2]);
    (me === 91 || me === 40) && (J = !1);
  }
  let te = 1;
  for (; te < A.length * 2; ) te <<= 1;
  const De = new Int32Array(te).fill(-1);
  for (let W = 0; W < A.length; W++) {
    const fe = M[E[W] * 2];
    let me = (Sm(R, fe, fe + M[E[W] * 2 + 1]) ^ Math.imul(A[W], 2654435761) | 0) & te - 1;
    for (; De[me] !== -1; ) me = me + 1 & te - 1;
    De[me] = W;
  }
  const ge = (W, fe, me, Be) => {
    let Qe = (Sm(fe, me, Be) ^ Math.imul(W, 2654435761) | 0) & te - 1;
    const qe = Be - me;
    for (; ; ) {
      const Ze = De[Qe];
      if (Ze === -1) return -1;
      if (A[Ze] === W && M[E[Ze] * 2 + 1] === qe) {
        const Nt = M[E[Ze] * 2];
        let wt = !0;
        for (let ke = 0; ke < qe; ke++) if (R.charCodeAt(Nt + ke) !== fe.charCodeAt(me + ke)) {
          wt = !1;
          break;
        }
        if (wt) return N[Ze];
      }
      Qe = Qe + 1 & te - 1;
    }
  }, ze = r.cacheSize ?? 8192, O = r.prefix ?? l.prefix ?? "", B = O === "" ? "" : O + ":", ce = B.length, oe = (j ?? []).map((W) => {
    throw new Error("cn: missing validator " + W);
  }), ye = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, de = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/, Ae = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, pe = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  let xe = 0, Ke = -1, Ue = -1, Le = -1, Se = -1;
  const be = (W) => W >= 97 && W <= 122 || W >= 65 && W <= 90 || W >= 48 && W <= 57 || W === 95, Ne = (W) => /\s/.test(String.fromCharCode(W)), Ee = (W, fe, me) => {
    if (xe = 0, Ke = -1, me - fe < 3) return;
    const Be = W.charCodeAt(fe), Qe = W.charCodeAt(me - 1);
    if (Be === 91 && Qe === 93) xe = 1;
    else if (Be === 40 && Qe === 41) xe = 2;
    else return;
    Le = fe + 1, Se = me - 1;
    let qe = fe + 1;
    if (be(W.charCodeAt(qe))) {
      for (qe++; qe < me - 1; ) {
        const Ze = W.charCodeAt(qe);
        if (!be(Ze) && Ze !== 45) break;
        qe++;
      }
      qe < me - 2 && W.charCodeAt(qe) === 58 && (Ke = fe + 1, Ue = qe, Le = qe + 1);
    }
  }, Ye = (W, fe, me, Be) => {
    if (me - fe !== Be.length) return !1;
    for (let Qe = 0; Qe < Be.length; Qe++) if (W.charCodeAt(fe + Qe) !== Be.charCodeAt(Qe)) return !1;
    return !0;
  }, re = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Me = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, je = (W) => !!W && !Number.isNaN(Number(W)), Pe = (W, fe, me) => {
    if (me - fe < 11 || !Ye(W, fe, fe + 10, "@container")) return !1;
    if (W.charCodeAt(fe + 10) === 47) return me - fe >= 12;
    const Be = W.charCodeAt(fe + 11);
    return Be === 115 && me - fe >= 17 && Ye(W, fe + 10, fe + 16, "-size/") || Be === 110 && me - fe >= 19 && Ye(W, fe + 10, fe + 18, "-normal/");
  }, ne = [
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    2,
    2,
    2
  ], ae = "length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight".split("|").map((W) => W.split(" ")), He = [
    2,
    3,
    1,
    0,
    0,
    0,
    4,
    5,
    0,
    0,
    0,
    0,
    0,
    1,
    1
  ], Ce = (W, fe, me, Be) => {
    if (W >= 10) {
      if (W >= 25) return oe[W - 25](fe.slice(me, Be));
      const Qe = W - 10;
      if (xe !== ne[Qe]) return !1;
      if (Ke >= 0) {
        for (const qe of ae[Qe]) if (Ye(fe, Ke, Ue, qe)) return !0;
        return !1;
      }
      switch (He[Qe]) {
        case 0:
          return !1;
        case 1:
          return !0;
        case 2: {
          const qe = fe.slice(Le, Se);
          return ye.test(qe) && !de.test(qe);
        }
        case 3:
          return je(fe.slice(Le, Se));
        case 4:
          return pe.test(fe.slice(Le, Se));
        default:
          return Ae.test(fe.slice(Le, Se));
      }
    }
    switch (W) {
      case 0:
        return !0;
      case 1:
        return xe === 0;
      case 2:
        return xe === 1;
      case 3:
        return xe === 2;
      case 4:
        return re.test(fe.slice(me, Be));
      case 5:
        return je(fe.slice(me, Be));
      case 6: {
        const Qe = fe.slice(me, Be);
        return !!Qe && Number.isInteger(Number(Qe));
      }
      case 7:
        return Be > me && fe.charCodeAt(Be - 1) === 37 && je(fe.slice(me, Be - 1));
      case 8:
        return Me.test(fe.slice(me, Be));
      default:
        return Pe(fe, me, Be);
    }
  }, Oe = new Set(typeof H == "string" ? H.split(" ") : H), St = (W, fe, me, Be, Qe, qe) => {
    const Ze = Sm(fe, me, Be) ^ (Qe ? 2654435769 : 0) | 0;
    let Nt = W.get(Ze);
    if (Nt !== void 0) e: for (let Fe = 0; Fe < Nt.length; Fe++) {
      const ct = Nt[Fe];
      if (!(ct.imp !== Qe || ct.k.length !== Be - me)) {
        for (let Xe = 0; Xe < ct.k.length; Xe++) if (ct.k.charCodeAt(Xe) !== fe.charCodeAt(me + Xe)) continue e;
        return ct.id;
      }
    }
    else W.set(Ze, Nt = []);
    const wt = fe.slice(me, Be), ke = qe(wt);
    return Nt.push({
      k: wt,
      imp: Qe,
      id: ke
    }), ke;
  };
  let Ct = /* @__PURE__ */ new Map(), At = /* @__PURE__ */ new Map(), ft = 2;
  const Wn = 4096, ql = (W, fe) => {
    const me = [];
    let Be = 0, Qe = 0, qe = 0;
    for (let ke = 0; ke < W.length; ke++) {
      const Fe = W.charCodeAt(ke);
      Be === 0 && Qe === 0 && Fe === 58 ? (me.push(W.slice(qe, ke)), qe = ke + 1) : Fe === 91 ? Be++ : Fe === 93 ? Be-- : Fe === 40 ? Qe++ : Fe === 41 && Qe--;
    }
    me.push(W.slice(qe));
    let Ze = me[0];
    if (me.length > 1) {
      const ke = [];
      let Fe = [];
      for (const ct of me) ct.charCodeAt(0) === 91 || Oe.has(ct) ? (Fe.length && (ke.push(...Fe.sort()), Fe = []), ke.push(ct)) : Fe.push(ct);
      Fe.length && ke.push(...Fe.sort()), Ze = ke.join(":");
    }
    const Nt = fe ? Ze + " !" : Ze;
    let wt = At.get(Nt);
    return wt === void 0 && At.set(Nt, wt = ft++), wt;
  };
  let yl = /* @__PURE__ */ new Map(), el = s;
  const Wl = s + 4096, Zt = () => el++, tl = 2097152, Tn = 8192, $t = new Int32Array(Tn), Bt = new Array(Tn).fill(null), ma = new Int32Array(Tn), en = new Int32Array(Tn), nt = new Uint8Array(Tn);
  let Rt = 0;
  const Ot = (W, fe, me, Be, Qe, qe, Ze, Nt) => {
    let wt = W;
    if (Bt[W] !== null)
      if (Bt[W | 1] === null) wt = W | 1;
      else if ((Rt++ & 3) === 0) wt = W | Rt >> 2 & 1;
      else return;
    Bt[wt] = fe.slice(me, Be), $t[wt] = Qe, ma[wt] = qe, en[wt] = Ze, nt[wt] = Nt;
  }, dt = () => Bt.fill(null);
  let lt = 256, pt = [
    new Int32Array(lt),
    new Int32Array(lt),
    new Int32Array(lt),
    new Int32Array(lt)
  ], [jt, at, dl, sn] = pt, An = new Uint8Array(lt), vt = new Uint8Array(lt);
  const nl = () => {
    lt *= 2, pt = pt.map((fe) => {
      const me = new Int32Array(lt);
      return me.set(fe), me;
    }), [jt, at, dl, sn] = pt;
    const W = new Uint8Array(lt);
    W.set(An), An = W, vt = new Uint8Array(lt);
  };
  let ut = 64, ml = new Int32Array(ut), Nl = new Int32Array(ut);
  const _n = new Int32Array(s);
  let On = 2048, Ia = 21, ll = new Float64Array(On), Va = new Int32Array(On), al = 0;
  const Gl = (W, fe) => {
    if (W === 0 && fe < s)
      return _n[fe] === al ? 1 : (_n[fe] = al, 0);
    const me = W * 2097152 + fe + 1;
    let Be = Math.imul(me, 2654435761) >>> Ia;
    for (; Va[Be] === al; ) {
      if (ll[Be] === me) return 1;
      Be = Be + 1 & On - 1;
    }
    return ll[Be] = me, Va[Be] = al, 0;
  }, tn = (W, fe, me, Be, Qe) => {
    if (me - fe >= 2 && W.charCodeAt(fe) === 91 && W.charCodeAt(me - 1) === 93) {
      let qe = -1;
      for (let Ze = fe + 1; Ze < me - 1; Ze++) if (W.charCodeAt(Ze) === 58) {
        qe = Ze;
        break;
      }
      return qe === -1 || qe === fe + 1 ? Ma : St(yl, W, fe + 1, qe, 0, Zt);
    }
    if (Be >= 0 && y[Be] >= 0) return y[Be];
    for (let qe = Qe - 1; qe >= 0; qe--) {
      const Ze = Nl[qe];
      if (Ze > me) continue;
      const Nt = ml[qe], wt = me - Ze;
      if (ie[Nt] === 1 && wt > 0 && wt <= P) {
        const Jt = W.charCodeAt(Ze);
        if (J === !1 || Jt !== 91 && Jt !== 40) {
          const Un = ge(Nt, W, Ze, me);
          if (Un >= 0) return Un;
        }
      }
      const ke = h[Nt];
      if (ke < 0) continue;
      const Fe = x[ke], ct = p[Fe], Xe = p[Fe + 1];
      if (ct === Xe) continue;
      Ee(W, Ze, me);
      const gn = G[ke] - ct;
      for (let Jt = ct; Jt < Xe; Jt++) if (Ce(g[Jt], W, Ze, me)) return T[gn + Jt];
    }
    return Ma;
  }, Ie = (W) => {
    const fe = W.length;
    let me = 0, Be = 0, Qe = !1;
    (ft > Wn || Ct.size > Wn) && (Ct = /* @__PURE__ */ new Map(), At = /* @__PURE__ */ new Map(), ft = 2, dt()), el > Wl && (yl = /* @__PURE__ */ new Map(), el = s, dt());
    let qe = 0;
    for (; qe < fe; ) {
      let ke = W.charCodeAt(qe);
      if (ke === 32 || ke >= 9 && ke <= 13 || ke >= 160 && Ne(ke)) {
        ke !== 32 && (Qe = !0), qe++;
        continue;
      }
      const Fe = qe;
      let ct = 0;
      for (; qe < fe; ) {
        if (ke = W.charCodeAt(qe), ke <= 32) {
          if (ke === 32) break;
          if (ke >= 9 && ke <= 13) {
            Qe = !0;
            break;
          }
        } else if (ke >= 160 && Ne(ke)) {
          Qe = !0;
          break;
        }
        ct = Math.imul(ct ^ ke, 16777619), qe++;
      }
      const Xe = qe, gn = Xe - Fe;
      me === lt && nl();
      const Jt = me++;
      jt[Jt] = Fe, at[Jt] = Xe, Be += gn, ct ^= Math.imul(gn, 2654435761);
      const Un = ct ^ ct >>> 15 | 0, cn = Un & 8190;
      {
        let bt = -1;
        if ($t[cn] === Un && Bt[cn] !== null && Bt[cn].length === gn ? bt = cn : $t[cn | 1] === Un && Bt[cn | 1] !== null && Bt[cn | 1].length === gn && (bt = cn | 1), bt >= 0) {
          const yn = Bt[bt];
          let ol = !0;
          for (let gl = 0; gl < gn; gl++) if (yn.charCodeAt(gl) !== W.charCodeAt(Fe + gl)) {
            ol = !1;
            break;
          }
          if (ol) {
            dl[Jt] = ma[bt], sn[Jt] = en[bt], An[Jt] = nt[bt];
            continue;
          }
        }
      }
      let ln = Fe;
      if (ce !== 0) {
        if (Xe - Fe <= ce || !W.startsWith(B, Fe)) {
          dl[Jt] = Ma, Ot(cn, W, Fe, Xe, Un, Ma, 0, 0);
          continue;
        }
        ln = Fe + ce;
      }
      let qa = 0, Ji = 0, ta = -1, Ga = -1;
      for (let bt = ln; bt < Xe; bt++) {
        const yn = W.charCodeAt(bt);
        if (qa === 0 && Ji === 0) {
          if (yn === 58) {
            ta = bt;
            continue;
          }
          if (yn === 47) {
            Ga = bt;
            continue;
          }
        }
        yn === 91 ? qa++ : yn === 93 ? qa-- : yn === 40 ? Ji++ : yn === 41 && Ji--;
      }
      const $i = ta >= ln ? ta + 1 : ln;
      let qt = $i, Nn = Xe, ha = !1, na = 0;
      Nn > qt && W.charCodeAt(Nn - 1) === 33 ? (ha = !0, Nn--) : Nn > qt && W.charCodeAt(qt) === 33 && (ha = !0, qt++, na = 1);
      let Xn = -1;
      Ga > $i && (Xn = Ga + na, Xn >= Nn && (Xn = -1));
      let la = qt;
      Nn - qt > 1 && W.charCodeAt(qt) === 45 && (la = qt + 1);
      let il = 0, pn = 0, aa = 0, pa = -1, vn = 0;
      (h[0] >= 0 || ie[0] === 1) && (ml[0] = 0, Nl[0] = la, vn = 1);
      let va = xo, pi = 0;
      for (let bt = la; bt < Nn; bt++)
        if (bt === Xn && (va = pn < aa ? xo : il, pi = vn), il !== xo) {
          const yn = W.charCodeAt(bt);
          let ol = -1;
          if (pn < aa)
            m.charCodeAt(pn) === yn ? (pn++, pn === aa && (ol = il = pa)) : il = xo;
          else {
            const gl = c[il], Xa = c[il + 1];
            let he = xo;
            for (let ve = gl; ve < Xa; ve++) {
              const We = f[ve];
              if (m.charCodeAt(We) === yn) {
                f[ve + 1] - We === 1 ? ol = he = v[ve] : (pn = We + 1, aa = f[ve + 1], pa = v[ve], he = il);
                break;
              }
            }
            il = he;
          }
          if (ol >= 0 && (h[ol] >= 0 || ie[ol] === 1) && bt + 1 < Nn && W.charCodeAt(bt + 1) === 45) {
            if (vn === ut) {
              ut *= 2;
              const gl = new Int32Array(ut);
              gl.set(ml), ml = gl;
              const Xa = new Int32Array(ut);
              Xa.set(Nl), Nl = Xa;
            }
            ml[vn] = ol, Nl[vn] = bt + 2, vn++;
          }
        }
      Xn === Nn && (va = pn < aa ? xo : il, pi = vn);
      const vi = pn < aa ? xo : il;
      let bn, In = !1;
      if (Xn >= 0)
        if (In = !0, bn = tn(W, qt, Xn, va, pi), bn !== Ma && bn < s && le[bn]) {
          const bt = tn(W, qt, Nn, vi, vn);
          bt !== Ma && bt !== bn && (bn = bt, In = !1);
        } else bn === Ma && (bn = tn(W, qt, Nn, vi, vn), In = !1);
      else bn = tn(W, qt, Nn, vi, vn);
      let Ya = 0, ka = 0;
      bn === Ma ? dl[Jt] = Ma : (ka = In ? 1 : 0, Ya = ln >= ta ? ha ? 1 : 0 : St(Ct, W, ln, ta, ha ? 1 : 0, (bt) => ql(bt, ha)), dl[Jt] = bn, An[Jt] = ka, sn[Jt] = Ya), Ot(cn, W, Fe, Xe, Un, bn, Ya, ka);
    }
    if (me === 0) return "";
    if (me === 1) return jt[0] === 0 && at[0] === fe ? W : W.slice(jt[0], at[0]);
    if (me * Z > On) {
      for (; me * Z > On; )
        On <<= 1, Ia--;
      ll = new Float64Array(On), Va = new Int32Array(On);
    }
    if (ft >= tl || el >= tl) throw new Error("cn: too many distinct classes in one merge");
    al = al + 1 | 0, al === 0 && (_n.fill(0), Va.fill(0), al = 1);
    let Ze = !1;
    for (let ke = me - 1; ke >= 0; ke--) {
      const Fe = dl[ke];
      if (Fe === Ma) {
        vt[ke] = 1;
        continue;
      }
      const ct = sn[ke];
      if (Gl(ct, Fe) === 1) {
        vt[ke] = 0, Ze = !0;
        continue;
      }
      if (vt[ke] = 1, Fe < s) {
        const Xe = q[Fe];
        if (Xe >= 0) for (let gn = C[Xe]; gn < C[Xe + 1]; gn++) Gl(ct, z[gn]);
        if (An[ke] & 1)
          for (let gn = 0; gn < V.length; gn++) V[gn] === Fe && Gl(ct, _[gn]);
      }
    }
    if (!Ze && !Qe && fe === Be + me - 1) return W;
    let Nt = "", wt = 0;
    for (; wt < me; ) {
      if (!vt[wt]) {
        wt++;
        continue;
      }
      const ke = jt[wt];
      let Fe = at[wt], ct = wt + 1;
      for (; ct < me && vt[ct] && jt[ct] === Fe + 1 && W.charCodeAt(Fe) === 32; )
        Fe = at[ct], ct++;
      Nt.length > 0 && (Nt += " "), Nt += W.slice(ke, Fe), wt = ct;
    }
    return Nt;
  }, wn = 16384, xl = new Int32Array(wn * 2);
  let La = 0, nn = 1, Xt = /* @__PURE__ */ Object.create(null), Mn = /* @__PURE__ */ Object.create(null), jn = /* @__PURE__ */ new Map(), gi = /* @__PURE__ */ new Map(), Yl = 0, ea = 0;
  const ga = () => {
    La ^= wn, nn = nn + 1 | 0, ea = 0;
  }, Ft = (W) => {
    let fe = Xt[W];
    if (fe !== void 0) return fe;
    const me = ac(W, 0, W.length), Be = (me & 16383) + La, Qe = xl[Be] === (me ^ nn) || xl[Be ^ wn] === (me ^ nn - 1);
    return Qe && (fe = Mn[W], fe !== void 0) ? (Xt[W] = fe, fe) : (fe = Ie(W), Qe ? (Xt[W] = fe, ++Yl > ze && (Yl = 0, Mn = Xt, Xt = /* @__PURE__ */ Object.create(null), ga())) : (xl[Be] = me ^ nn, ++ea > wn && ga()), fe);
  }, Hn = (W) => {
    let fe = jn.get(W);
    if (fe !== void 0) return fe;
    const me = ac(W, 0, W.length), Be = (me & 16383) + La, Qe = xl[Be] === (me ^ nn) || xl[Be ^ wn] === (me ^ nn - 1);
    return Qe && (fe = gi.get(W), fe !== void 0) ? (jn.set(W, fe), fe) : (fe = Ie(W), Qe ? (jn.set(W, fe), ++Yl > ze && (Yl = 0, gi = jn, jn = /* @__PURE__ */ new Map(), ga())) : (xl[Be] = me ^ nn, ++ea > wn && ga()), fe);
  }, hi = (W) => {
    const fe = ac(W, 0, W.length), me = (fe & 16383) + La;
    return xl[me] === (fe ^ nn) || xl[me ^ wn] === (fe ^ nn - 1) ? !0 : (xl[me] = fe ^ nn, ++ea > wn && ga(), !1);
  }, Sl = ze === 0 ? Ie : kE ? (W) => {
    const fe = jn.get(W);
    return fe !== void 0 ? fe : Hn(W);
  } : Ft;
  return {
    merge: function() {
      return arguments.length === 1 && typeof arguments[0] == "string" ? Sl(arguments[0]) : Sl(PE.apply(null, arguments));
    },
    mergeString: Sl,
    seenBefore: ze === 0 ? () => !1 : hi,
    mergeUncached: Ie
  };
}, cc = (l, i) => {
  if (!l) return "";
  if (typeof l == "string") return l;
  let r = "";
  if (typeof l.length == "number" && (!i || Array.isArray(l))) {
    const s = l;
    for (let c = 0; c < s.length; c++) {
      const f = s[c];
      if (!f) continue;
      const m = typeof f == "string" ? f : cc(f, i);
      m && (r && (r += " "), r += m);
    }
    return r;
  }
  if (i) {
    if (typeof l == "number") return "" + l;
    if (typeof l == "object")
      for (const s in l) l[s] && (r && (r += " "), r += s);
  }
  return r;
}, KE = (l, i) => {
  let r = "";
  for (let s = 0; s < l.length; s++) {
    const c = l[s];
    if (!c) continue;
    const f = typeof c == "string" ? c : cc(c, i);
    f && (r && (r += " "), r += f);
  }
  return r;
}, PE = function() {
  return KE(arguments, !1);
}, QE = 256, tb = 16, ZE = 1024, Em = 4096, FE = (l, i) => {
  const r = i === void 0 ? () => !0 : i.seenBefore, s = i === void 0 ? l : i.mergeUncached;
  let c = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), m = 0, v = null, y = null, h = [], p = [], g = 0;
  const x = (M, R, I) => {
    y === null && (y = new Array(Em).fill(""), h = new Array(Em).fill(""), p = new Array(Em).fill(""));
    const C = ac(M, 0, M.length) & 4094;
    if (y[C] === M && h[C] === R) return p[C];
    if (y[C | 1] === M && h[C | 1] === R) return p[C | 1];
    const z = l(I ? R + " " + M : M), V = y[C] === "" ? C : C | (y[C | 1] === "" ? 1 : g++ & 1);
    return y[V] = M, h[V] = R, p[V] = z, z;
  }, T = (M, R, I, C) => {
    let z = 0;
    if (R) {
      if (R !== M.a0) return !1;
      z = 1;
    }
    if (I) {
      if (I !== (z === 0 ? M.a0 : M.a1)) return !1;
      z++;
    }
    if (C) {
      if (C !== (z === 0 ? M.a0 : z === 1 ? M.a1 : M.a2)) return !1;
      z++;
    }
    return z === M.t;
  }, A = (M, R) => {
    const I = M.a;
    let C = 0;
    for (let z = 0; z < R.length; z++) {
      const V = R[z];
      if (V) {
        if (V !== I[C]) return !1;
        C++;
      }
    }
    return C === M.t;
  }, N = (M, R) => {
    const I = M.length, C = v === null ? null : v.n;
    if (!R) {
      if (C !== null && A(C, M))
        return v = C, C.r;
      if (v !== null && v !== C && A(v, M)) return v.r;
    }
    let z = "", V = -1, _ = 0, U = !1;
    for (let q = 0; q < I; q++) {
      let $ = M[q];
      if ($) {
        if (typeof $ != "string") {
          if ($ = M[q] = cc($, !0), !$) continue;
          U = !0;
        }
        V < 0 && (z = $, V = q), _++;
      }
    }
    if (_ === 0) return "";
    if (_ === 1) return l(z);
    if (U) {
      if (C !== null && A(C, M))
        return v = C, C.r;
      if (v !== null && v !== C && A(v, M)) return v.r;
    }
    let j = c.get(z);
    j === void 0 && (j = f.get(z), j !== void 0 && c.set(z, j));
    let H = null;
    if (j !== void 0) {
      if (j.skip > 0) {
        j.skip--, v = null;
        let $ = z;
        for (let Z = V + 1; Z < I; Z++) {
          const G = M[Z];
          G && ($ += " " + G);
        }
        return x($, "", !1);
      }
      const q = j.e;
      e: for (let $ = 0; $ < q.length; $++) {
        const Z = q[$];
        if (Z.t !== _) continue;
        const G = Z.a;
        let le = 1;
        for (let k = V + 1; k < I; k++) {
          const ie = M[k];
          if (ie && ie !== G[le++]) continue e;
        }
        H = Z;
        break;
      }
      H !== null && (j.miss = 0);
    }
    if (H === null) {
      let q = z;
      const $ = [z];
      for (let G = V + 1; G < I; G++) {
        const le = M[G];
        le && (q += " " + le, $.push(le));
      }
      if (!r(q)) return s(q);
      H = {
        r: l(q),
        t: $.length,
        a0: $[0],
        a1: $[1],
        a2: $[2] ?? "",
        a: $,
        n: null
      }, j === void 0 ? c.set(z, j = {
        e: [],
        miss: 0,
        skip: 0,
        at: 0
      }) : ++j.miss > tb && (j.miss = tb, j.skip = ZE, j.e.length = 0, j.at = 0);
      const Z = j.e;
      Z.length < QE ? Z.push(H) : (Z[j.at] = H, j.at = j.at + 1 & 255), ++m > 1e3 && (m = 0, f = c, c = /* @__PURE__ */ new Map());
    }
    return v !== null && v !== H && (v.n = H), v = H, H.r;
  }, E = (M) => Array.isArray(M) ? N(M.slice(), !1) : l(cc(M, !0));
  return function(M, R, I) {
    const C = arguments.length;
    if ((C | 1) === 3) {
      const _ = v;
      if (_ !== null) {
        const U = _.n;
        if (U !== null && T(U, M, R, I))
          return v = U, U.r;
        if (_ !== U && T(_, M, R, I)) return _.r;
      }
      if (C === 2 && typeof R == "string" && R !== "") {
        const U = c.get(M);
        if (U !== void 0 && U.skip > 0)
          return U.skip--, v = null, x(R, M, !0);
      }
      return N([
        M,
        R,
        I
      ], !0);
    }
    if (C === 1) return typeof M == "string" ? l(M) : E(M);
    const z = v;
    if (z !== null) {
      const _ = z.n;
      if (_ !== null) {
        const U = _.a;
        let j = 0, H = !0;
        for (let q = 0; q < C; q++) {
          const $ = arguments[q];
          if ($) {
            if ($ !== U[j]) {
              H = !1;
              break;
            }
            j++;
          }
        }
        if (H && j === _.t)
          return v = _, _.r;
      }
      if (z !== _) {
        const U = z.a;
        let j = 0, H = !0;
        for (let q = 0; q < C; q++) {
          const $ = arguments[q];
          if ($) {
            if ($ !== U[j]) {
              H = !1;
              break;
            }
            j++;
          }
        }
        if (H && j === z.t) return z.r;
      }
    }
    const V = [];
    for (let _ = 0; _ < C; _++) V.push(arguments[_]);
    return N(V, !0);
  };
}, nb = /* @__PURE__ */ XE(YE), $e = /* @__PURE__ */ FE(nb.mergeString, nb);
const JE = (l) => l?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
function $E(l, i, r = []) {
  if (i == null)
    throw new Error("[lucide]: iconNode is required when icon name is used");
  return {
    name: JE(l),
    size: 24,
    node: i,
    ...r.length > 0 ? { aliases: r } : {}
  };
}
const WE = (l) => {
  let i = "", r = !1;
  for (const s of l) {
    if (s === "-" || s === "_" || s <= " ") {
      r = i.length > 0;
      continue;
    }
    i.length === 0 ? i += s.toLowerCase() : i += r ? s.toUpperCase() : s, r = !1;
  }
  return i;
};
const eC = (l) => {
  const i = WE(l);
  return i.charAt(0).toUpperCase() + i.slice(1);
};
const Ym = (...l) => l.filter((i, r, s) => !!i && i.trim() !== "" && s.indexOf(i) === r).join(" ").trim();
const So = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
function Cm(l) {
  return l != null;
}
function tC(l, i = {}) {
  const r = i.attributeNames ?? {}, s = (x) => r[x] ?? x, c = l.size ?? l.width ?? So.width, f = l.size ?? l.height ?? So.height, m = l.aliases?.filter((x) => typeof x == "string" && x.trim() !== "").map((x) => `lucide-${x}`) ?? [], v = [...l.name ? [`lucide-${l.name}`] : [], ...m], y = i.className?.split(" ").filter(Boolean) ?? [], h = i.includeDefaultClasses === !1 ? Ym(...y) : Ym("lucide", ...v, ...y), p = i.absoluteStrokeWidth ? Number(i.strokeWidth ?? So["stroke-width"]) * Number(l.size ?? l.width ?? So.width) / Number(i.size ?? i.width ?? So.width) : i.strokeWidth ?? So["stroke-width"];
  return [
    "svg",
    {
      ...Object.entries(So).reduce((x, [T, A]) => (x[s(T)] = A, x), {}),
      ..."color" in i && i.color && {
        [s("stroke")]: i.color
      },
      ..."size" in i && Cm(i.size) && {
        [s("width")]: i.size,
        [s("height")]: i.size
      },
      ..."width" in i && Cm(i.width) && {
        [s("width")]: i.width
      },
      ..."height" in i && Cm(i.height) && {
        [s("height")]: i.height
      },
      [s("stroke-width")]: p,
      ...h && {
        [s("class")]: h
      },
      [s("viewBox")]: `0 0 ${c} ${f}`,
      ...i.hasA11yProp === !1 ? {
        [s("aria-hidden")]: "true"
      } : {},
      ..."attributes" in i && i.attributes
    },
    l.node.map((x) => {
      const [T, A, N] = x, E = i.nonScalingStroke ? { [s("vector-effect")]: "non-scaling-stroke", ...A } : A;
      return N ? [T, E, N] : [T, E];
    })
  ];
}
function nC(l, i = {}) {
  return tC(l, {
    ...i,
    attributeNames: {
      ...i.attributeNames,
      class: "className",
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "vector-effect": "vectorEffect"
    }
  });
}
const lC = (l) => {
  for (const i in l)
    if (i.startsWith("aria-") || i === "role" || i === "title")
      return !0;
  return !1;
}, aC = b.createContext({}), iC = () => b.useContext(aC), oC = b.forwardRef(
  ({
    color: l,
    size: i,
    width: r,
    height: s,
    strokeWidth: c,
    absoluteStrokeWidth: f,
    nonScalingStroke: m,
    className: v = "",
    children: y,
    iconNode: h = [],
    icon: p = {
      node: h,
      aliases: [],
      size: 24
    },
    ...g
  }, x) => {
    const {
      size: T = 24,
      strokeWidth: A = 2,
      absoluteStrokeWidth: N = !1,
      nonScalingStroke: E = !1,
      color: M = "currentColor",
      className: R = ""
    } = iC() ?? {}, I = !!y || lC(g), [C, z, V = []] = nC(p, {
      color: l ?? M,
      width: r ?? i ?? T,
      height: s ?? i ?? T,
      strokeWidth: c ?? A,
      absoluteStrokeWidth: f ?? N,
      nonScalingStroke: m ?? E,
      className: Ym(R, v),
      hasA11yProp: I,
      attributes: g
    });
    return b.createElement(
      C,
      {
        ref: x,
        ...z
      },
      [
        ...V.map(([_, U]) => b.createElement(_, U)),
        ...Array.isArray(y) ? y : [y]
      ]
    );
  }
);
function fi(l, i = [], r = []) {
  const s = typeof l == "string" ? $E(l, i, r) : l, c = b.forwardRef(
    ({ className: f, ...m }, v) => b.createElement(oC, {
      ref: v,
      icon: s,
      className: f,
      ...m
    })
  );
  return s.name && (c.displayName = eC(s.name)), c;
}
const hy = {
  name: "arrow-right",
  size: 24,
  node: [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
  ]
};
hy.node;
const rC = fi(hy);
const py = {
  name: "check",
  size: 24,
  node: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]
};
py.node;
const vy = fi(py);
const by = {
  name: "chevron-down",
  size: 24,
  node: [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]
};
by.node;
const yy = fi(by);
const xy = {
  name: "chevron-up",
  size: 24,
  node: [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]]
};
xy.node;
const uC = fi(xy);
const Sy = {
  name: "chevron-right",
  size: 24,
  node: [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]]
};
Sy.node;
const sC = fi(Sy);
const Ey = {
  name: "rotate-ccw",
  size: 24,
  node: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
  ]
};
Ey.node;
const cC = fi(Ey);
const Cy = {
  name: "search",
  size: 24,
  node: [
    ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
  ]
};
Cy.node;
const Ry = fi(Cy);
const Ty = {
  name: "shield",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ]
  ]
};
Ty.node;
const fC = fi(Ty);
const Ay = {
  name: "x",
  size: 24,
  node: [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]
};
Ay.node;
const c0 = fi(Ay);
function To({
  controlled: l,
  default: i,
  name: r,
  state: s = "value"
}) {
  const {
    current: c
  } = b.useRef(l !== void 0), [f, m] = b.useState(() => i), v = c && l !== void 0 ? l : f, y = b.useCallback((h) => {
    c || m(h);
  }, []);
  return [v, y];
}
const f0 = {
  ...hE
}, lb = {};
function fl(l, i) {
  const r = b.useRef(lb);
  return r.current === lb && (r.current = l(i)), r;
}
const Rm = f0.useInsertionEffect, dC = (
  // React 17 doesn't have useInsertionEffect.
  Rm && // Preact replaces useInsertionEffect with useLayoutEffect and fires too late.
  Rm !== f0.useLayoutEffect ? Rm : (l) => l()
);
function Re(l) {
  const i = fl(mC).current;
  return i.next = l, dC(i.effect), i.trampoline;
}
function mC() {
  const l = {
    next: void 0,
    callback: gC,
    trampoline: (...i) => l.callback?.(...i),
    effect: () => {
      l.callback = l.next;
    }
  };
  return l;
}
function gC() {
}
function zt() {
}
const Vl = Object.freeze([]), un = Object.freeze({}), hC = () => {
}, Te = typeof document < "u" ? b.useLayoutEffect : hC, Oy = /* @__PURE__ */ b.createContext({
  register: () => {
  },
  unregister: () => {
  },
  subscribeMapChange: () => () => {
  },
  nextIndexRef: {
    current: 0
  }
});
function pC() {
  return b.useContext(Oy);
}
function wc(l) {
  const {
    children: i,
    elementsRef: r,
    labelsRef: s,
    onMapChange: c
  } = l, f = Re(c), [, m] = b.useState(0), v = fl(bC).current, y = fl(vC).current, h = b.useRef(0), p = b.useRef(!0), g = b.useRef(null), x = b.useRef(null), T = Re(() => {
    p.current || (p.current = !0, m((z) => z + 1));
  }), A = Re((z, V) => {
    y.set(z, V), T();
  }), N = Re((z) => {
    y.delete(z), T();
  }), E = Re((z) => {
    const V = /* @__PURE__ */ new Map();
    return r.current.length = 0, s && (s.current.length = 0), z.forEach((_) => {
      V.set(_.element, {
        ..._.registration.metadata ?? {},
        index: _.index
      }), r.current[_.index] = _.element, s && (s.current[_.index] = _.registration.label !== void 0 ? _.registration.label : _.registration.textRef?.current?.textContent ?? _.element.textContent);
    }), h.current = r.current.length, V;
  });
  function M(z) {
    if (x.current?.disconnect(), x.current = null, typeof MutationObserver != "function" || z.length < 2)
      return;
    const V = new MutationObserver((U) => {
      if (!SC(U))
        return;
      let j = null;
      for (const H of z)
        if (H.isConnected) {
          if (j && wy(j, H) > 0) {
            V.disconnect(), T();
            return;
          }
          j = H;
        }
    });
    x.current = V;
    const _ = /* @__PURE__ */ new Set();
    for (let U = 1; U < z.length; U += 1) {
      const j = xC(z[U - 1], z[U]);
      j && _.add(j);
    }
    _.forEach((U) => V.observe(U, {
      childList: !0
    }));
  }
  const R = Re(() => {
    const [z, V] = yC(y), _ = E(z), U = g.current, j = !U || U.length !== z.length || z.some((H, q) => {
      const $ = U[q];
      return H.index !== $.index || H.element !== $.element || H.registration.index !== $.registration.index || H.registration.metadata !== $.registration.metadata;
    });
    M(V), g.current = z, p.current = !1, j && (v.forEach((H) => H(_)), f(_));
  });
  Te(() => (!p.current && g.current && E(g.current), () => {
    r.current = [], s && (s.current = []);
  }), [r, s, E]), Te(() => {
    p.current && R();
  }), Te(() => () => {
    x.current?.disconnect(), p.current = !0;
  }, []);
  const I = Re((z) => (v.add(z), () => {
    v.delete(z);
  })), C = b.useMemo(() => ({
    register: A,
    unregister: N,
    subscribeMapChange: I,
    nextIndexRef: h
  }), [A, N, I, h]);
  return /* @__PURE__ */ w.jsx(Oy.Provider, {
    value: C,
    children: i
  });
}
function vC() {
  return /* @__PURE__ */ new Map();
}
function bC() {
  return /* @__PURE__ */ new Set();
}
function yC(l) {
  const i = /* @__PURE__ */ new Set(), r = [], s = [];
  l.forEach((f, m) => {
    if (!m.isConnected)
      return;
    const v = f.index, y = {
      index: v ?? -1,
      element: m,
      registration: f
    };
    v === null ? s.push(y) : v >= 0 && (i.add(v), r.push(y));
  });
  let c = 0;
  return s.sort((f, m) => wy(f.element, m.element)), s.forEach((f) => {
    for (; i.has(c); )
      c += 1;
    f.index = c, r.push(f), c += 1;
  }), i.size > 0 && r.sort((f, m) => f.index - m.index), [r, s.map((f) => f.element)];
}
function xC(l, i) {
  let r = l.parentElement;
  for (; r && !r.contains(i); )
    r = r.parentElement;
  return r;
}
function SC(l) {
  for (const i of l)
    for (let r = 0; r < i.removedNodes.length; r += 1)
      if (i.removedNodes[r].isConnected)
        return !0;
  return !1;
}
function wy(l, i) {
  return l.nextElementSibling === i ? -1 : i.nextElementSibling === l ? 1 : l.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
function EC(l, i) {
  return function(s, ...c) {
    const f = new URL(l);
    return f.searchParams.set("code", s.toString()), c.forEach((m) => f.searchParams.append("args[]", m)), `${i} error #${s}; visit ${f} for the full message.`;
  };
}
const Rn = EC("https://base-ui.com/production-error", "Base UI"), My = /* @__PURE__ */ b.createContext(void 0);
function Ny() {
  const l = b.useContext(My);
  if (l === void 0)
    throw new Error(Rn(10));
  return l;
}
function da(l, i, r, s) {
  const c = fl(Dy).current;
  return RC(c, l, i, r, s) && zy(c, [l, i, r, s]), c.callback;
}
function CC(l) {
  const i = fl(Dy).current;
  return TC(i, l) && zy(i, l), i.callback;
}
function Dy() {
  return {
    callback: null,
    cleanup: null,
    refs: []
  };
}
function RC(l, i, r, s, c) {
  return l.refs[0] !== i || l.refs[1] !== r || l.refs[2] !== s || l.refs[3] !== c;
}
function TC(l, i) {
  return l.refs.length !== i.length || l.refs.some((r, s) => r !== i[s]);
}
function zy(l, i) {
  if (l.refs = i, i.every((r) => r == null)) {
    l.callback = null;
    return;
  }
  l.callback = (r) => {
    if (l.cleanup && (l.cleanup(), l.cleanup = null), r != null) {
      const s = Array(i.length).fill(null);
      for (let c = 0; c < i.length; c += 1) {
        const f = i[c];
        if (f != null)
          switch (typeof f) {
            case "function": {
              const m = f(r);
              typeof m == "function" && (s[c] = m);
              break;
            }
            case "object": {
              f.current = r;
              break;
            }
          }
      }
      l.cleanup = () => {
        for (let c = 0; c < i.length; c += 1) {
          const f = i[c];
          if (f != null)
            switch (typeof f) {
              case "function": {
                const m = s[c];
                typeof m == "function" ? m() : f(null);
                break;
              }
              case "object": {
                f.current = null;
                break;
              }
            }
        }
      };
    }
  };
}
const AC = parseInt(b.version, 10);
function d0(l) {
  return AC >= l;
}
function ab(l) {
  if (!/* @__PURE__ */ b.isValidElement(l))
    return null;
  const i = l, r = i.props;
  return (d0(19) ? r?.ref : i.ref) ?? null;
}
function km(l, i) {
  if (l && !i)
    return l;
  if (!l && i)
    return i;
  if (l || i)
    return {
      ...l,
      ...i
    };
}
function OC(l, i) {
  const r = {};
  for (const s in l) {
    const c = l[s];
    if (i?.hasOwnProperty(s)) {
      const f = i[s](c);
      f != null && Object.assign(r, f);
      continue;
    }
    c === !0 ? r[`data-${s.toLowerCase()}`] = "" : c && (r[`data-${s.toLowerCase()}`] = c.toString());
  }
  return r;
}
function wC(l, i) {
  return typeof l == "function" ? l(i) : l;
}
function _y(l, i) {
  return typeof l == "function" ? l(i) : l;
}
const jy = {};
function Ao(l, i, r, s, c) {
  if (!r && !s && !c && !l)
    return fc(i);
  let f = fc(l);
  return i && (f = xu(f, i)), r && (f = xu(f, r)), s && (f = xu(f, s)), c && (f = xu(f, c)), f;
}
function MC(l) {
  if (l.length === 0)
    return jy;
  if (l.length === 1)
    return fc(l[0]);
  let i = fc(l[0]);
  for (let r = 1; r < l.length; r += 1)
    i = xu(i, l[r]);
  return i;
}
function fc(l) {
  return Uy(l) ? {
    ...l(jy)
  } : NC(l);
}
function xu(l, i) {
  return Uy(i) ? i(l) : DC(l, i);
}
function NC(l) {
  const i = {
    ...l
  };
  for (const r in i) {
    const s = i[r];
    Hy(r, s) && (i[r] = Iy(s));
  }
  return i;
}
function DC(l, i) {
  if (!i)
    return l;
  for (const r in i) {
    const s = i[r];
    switch (r) {
      case "style": {
        l[r] = km(l.style, s);
        break;
      }
      case "className": {
        l[r] = Vy(l.className, s);
        break;
      }
      default:
        Hy(r, s) ? l[r] = zC(l[r], s) : l[r] = s;
    }
  }
  return l;
}
function Hy(l, i) {
  const r = l.charCodeAt(0), s = l.charCodeAt(1), c = l.charCodeAt(2);
  return r === 111 && s === 110 && c >= 65 && c <= 90 && (typeof i == "function" || typeof i > "u");
}
function Uy(l) {
  return typeof l == "function";
}
function zC(l, i) {
  return i ? l ? (...r) => {
    const s = r[0];
    if (Ly(s)) {
      const f = s;
      dc(f);
      const m = i(...r);
      return f.baseUIHandlerPrevented || l?.(...r), m;
    }
    const c = i(...r);
    return l?.(...r), c;
  } : Iy(i) : l;
}
function Iy(l) {
  return l && ((...i) => {
    const r = i[0];
    return Ly(r) && dc(r), l(...i);
  });
}
function dc(l) {
  return l.preventBaseUIHandler = () => {
    l.baseUIHandlerPrevented = !0;
  }, l;
}
function Vy(l, i) {
  return i ? l ? i + " " + l : i : l;
}
function Ly(l) {
  return l != null && typeof l == "object" && "nativeEvent" in l;
}
function Tt(l, i, r = {}) {
  let s = i.render;
  r.enabled !== !1 && (s = UC(s));
  const c = _C(i, r, s);
  if (r.enabled === !1)
    return null;
  const f = r.state ?? un;
  return IC(l, s, c, f);
}
function _C(l, i, r) {
  const {
    className: s,
    style: c
  } = l, {
    state: f = un,
    ref: m,
    props: v,
    stateAttributesMapping: y,
    enabled: h = !0
  } = i, p = h ? wC(s, f) : void 0, g = h ? _y(c, f) : void 0, x = h ? OC(f, y) : un, T = h && v ? jC(v) : void 0, A = h ? km(x, T) ?? {} : un;
  return typeof document < "u" && (h ? Array.isArray(m) ? A.ref = CC([A.ref, ab(r), ...m]) : A.ref = da(A.ref, ab(r), m) : da(null, null)), h ? (p !== void 0 && (A.className = Vy(A.className, p)), g !== void 0 && (A.style = km(A.style, g)), A) : un;
}
function jC(l) {
  return Array.isArray(l) ? MC(l) : Ao(void 0, l);
}
const HC = /* @__PURE__ */ Symbol.for("react.lazy");
function UC(l) {
  if (l?.$$typeof !== HC)
    return l;
  const i = b.Children.toArray(l)[0];
  return /* @__PURE__ */ b.isValidElement(i) ? i : l;
}
function IC(l, i, r, s) {
  if (i) {
    if (typeof i == "function")
      return i(r, s);
    const c = Ao(r, i.props);
    return c.ref = r.ref, /* @__PURE__ */ b.cloneElement(i, c);
  }
  return VC(l, r);
}
function VC(l, i) {
  return l === "button" ? /* @__PURE__ */ b.createElement("button", {
    type: "button",
    ...i,
    key: i.key
  }) : l === "img" ? /* @__PURE__ */ b.createElement("img", {
    alt: "",
    ...i,
    key: i.key
  }) : /* @__PURE__ */ b.createElement(l, i);
}
const LC = {
  value: () => null
}, BC = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    disabled: f = !1,
    hiddenUntilFound: m,
    keepMounted: v,
    loopFocus: y,
    onValueChange: h,
    multiple: p = !1,
    orientation: g = "vertical",
    value: x,
    defaultValue: T,
    style: A,
    ...N
  } = i, E = T ?? Vl, M = b.useRef([]), [R, I] = To({
    controlled: x,
    default: E,
    name: "Accordion",
    state: "value"
  }), C = Re((U, j, H) => {
    let q;
    p ? j ? q = [...R, U] : q = R.filter(($) => $ !== U) : q = R[0] === U ? [] : [U], h?.(q, H), !H.isCanceled && I(q);
  }), z = b.useMemo(() => ({
    value: R,
    disabled: f,
    orientation: g
  }), [R, f, g]), V = b.useMemo(() => ({
    disabled: f,
    handleValueChange: C,
    hiddenUntilFound: m ?? !1,
    keepMounted: v ?? !1,
    state: z,
    value: R
  }), [f, C, m, v, z, R]), _ = Tt("div", i, {
    state: z,
    ref: r,
    props: N,
    stateAttributesMapping: LC
  });
  return /* @__PURE__ */ w.jsx(My.Provider, {
    value: V,
    children: /* @__PURE__ */ w.jsx(wc, {
      elementsRef: M,
      children: _
    })
  });
});
function By() {
  const [, l] = b.useState({});
  return b.useCallback(() => {
    l({});
  }, []);
}
let ib = 0;
function qC(l, i = "mui") {
  const r = b.useRef(void 0), s = By(), c = l ?? r.current;
  return b.useEffect(() => {
    r.current == null && (ib += 1, r.current = `${i}-${ib}`, l == null && s());
  }, [l, i, s]), c;
}
const ob = f0.useId;
function Mc(l, i) {
  if (ob !== void 0) {
    const r = ob();
    return l ?? (i ? `${i}-${r}` : r);
  }
  return qC(l, i);
}
function wl(l) {
  return Mc(l, "base-ui");
}
function it(l, i, r, s) {
  let c = !1, f = !1;
  const m = s ?? un;
  return {
    reason: l,
    event: i ?? new Event("base-ui"),
    cancel() {
      c = !0;
    },
    allowPropagation() {
      f = !0;
    },
    get isCanceled() {
      return c;
    },
    get isPropagationAllowed() {
      return f;
    },
    trigger: r,
    ...m
  };
}
function GC(l, i, r) {
  const s = r ?? un;
  return {
    reason: l,
    event: i ?? new Event("base-ui"),
    ...s
  };
}
const Yn = "none", m0 = "trigger-press", YC = "trigger-hover", g0 = "outside-press", rb = "item-press", qy = "close-press", ub = "clear-press", br = "input-change", Na = "input-clear", kC = "input-press", Ru = "focus-out", h0 = "escape-key", Xm = "list-navigation", XC = "keyboard", KC = "pointer", PC = "cancel-open", QC = "disabled", sb = "missing", cb = "initial", Gy = "imperative-action";
function Yy(l) {
  b.useEffect(l, Vl);
}
const Ps = null;
class ZC {
  /* This implementation uses an array as a backing data-structure for frame callbacks.
   * It allows `O(1)` callback cancelling by inserting a `null` in the array, though it
   * never calls the native `cancelAnimationFrame` if there are no frames left. This can
   * be much more efficient if there is a call pattern that alterns as
   * "request-cancel-request-cancel-…".
   * But in the case of "request-request-…-cancel-cancel-…", it leaves the final animation
   * frame to run anyway. We turn that frame into a `O(1)` no-op via `callbacksCount`. */
  callbacks = [];
  callbacksCount = 0;
  nextId = 1;
  startId = 1;
  isScheduled = !1;
  tick = (i) => {
    this.isScheduled = !1;
    const r = this.callbacks, s = this.callbacksCount;
    if (this.callbacks = [], this.callbacksCount = 0, this.startId = this.nextId, s > 0)
      for (let c = 0; c < r.length; c += 1)
        r[c]?.(i);
  };
  request(i) {
    const r = this.nextId;
    return this.nextId += 1, this.callbacks.push(i), this.callbacksCount += 1, !this.isScheduled && (requestAnimationFrame(this.tick), this.isScheduled = !0), r;
  }
  cancel(i) {
    const r = i - this.startId;
    r < 0 || r >= this.callbacks.length || this.callbacks[r] !== null && (this.callbacks[r] = null, this.callbacksCount -= 1);
  }
}
let Qs = new ZC();
class ul {
  static create() {
    return new ul();
  }
  static request(i) {
    return Qs.request(i);
  }
  static cancel(i) {
    return Qs.cancel(i);
  }
  currentId = Ps;
  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  request(i) {
    this.cancel(), this.currentId = Qs.request(() => {
      this.currentId = Ps, i();
    });
  }
  cancel = () => {
    this.currentId !== Ps && (Qs.cancel(this.currentId), this.currentId = Ps);
  };
  disposeEffect = () => this.cancel;
}
function Tu() {
  const l = fl(ul.create).current;
  return Yy(l.disposeEffect), l;
}
function Tr(l, i = !1, r = !1, s = !1) {
  const [c, f] = b.useState(l && i ? "idle" : void 0), [m, v] = b.useState(l && !s);
  return l && !m && (v(!0), f("starting")), !l && m && c !== "ending" && !r && f("ending"), !l && !m && c === "ending" && f(void 0), Te(() => {
    if (!l && m && c !== "ending" && r) {
      const y = ul.request(() => {
        f("ending");
      });
      return () => {
        ul.cancel(y);
      };
    }
  }, [l, m, c, r]), Te(() => {
    if (!l || i || c === void 0)
      return;
    const y = ul.request(() => {
      f(void 0);
    });
    return () => {
      ul.cancel(y);
    };
  }, [i, l, c]), Te(() => {
    if (!l || !i)
      return;
    l && m && c !== "idle" && f("starting");
    const y = ul.request(() => {
      f("idle");
    });
    return () => {
      ul.cancel(y);
    };
  }, [i, l, m, c]), {
    mounted: m,
    setMounted: v,
    transitionStatus: c
  };
}
function FC(l) {
  const {
    open: i,
    defaultOpen: r = !1,
    onOpenChange: s,
    disabled: c
  } = l, [f, m] = To({
    controlled: i,
    default: r,
    name: "Collapsible",
    state: "open"
  }), {
    mounted: v,
    setMounted: y,
    transitionStatus: h
  } = Tr(f, !0, !0), p = wl(), [g, x] = b.useState(), T = g === null ? void 0 : g ?? p, A = Re((N) => {
    const E = !f, M = it(m0, N.nativeEvent);
    s(E, M), !M.isCanceled && m(E);
  });
  return b.useMemo(() => ({
    defaultPanelId: p,
    disabled: c,
    handleTrigger: A,
    mounted: v,
    open: f,
    panelId: T,
    setMounted: y,
    setOpen: m,
    setPanelIdState: x,
    transitionStatus: h
  }), [p, c, A, v, f, T, y, m, x, h]);
}
const ky = /* @__PURE__ */ b.createContext(void 0);
function Xy() {
  const l = b.useContext(ky);
  if (l === void 0)
    throw new Error(Rn(15));
  return l;
}
function Nc(l = {}) {
  const {
    guess: i,
    label: r,
    metadata: s,
    textRef: c,
    index: f
  } = l, {
    register: m,
    unregister: v,
    subscribeMapChange: y,
    nextIndexRef: h
  } = pC(), p = b.useRef(-1), [g, x] = b.useState(f == null && i ? () => {
    if (p.current === -1) {
      const E = h.current;
      h.current += 1, p.current = E;
    }
    return p.current;
  } : -1), T = f ?? g, A = b.useRef(null), N = b.useCallback((E) => {
    const M = A.current;
    M && v(M), A.current = E, E && m(E, {
      metadata: s ?? null,
      index: f ?? null,
      label: r,
      textRef: c
    });
  }, [f, m, v, s, r, c]);
  return Te(() => {
    if (f == null)
      return y((E) => {
        const M = A.current ? E.get(A.current)?.index : null;
        M != null && x(M);
      });
  }, [f, y]), {
    ref: N,
    index: T
  };
}
const Ky = /* @__PURE__ */ b.createContext(void 0);
function p0() {
  const l = b.useContext(Ky);
  if (l === void 0)
    throw new Error(Rn(9));
  return l;
}
const v0 = "data-starting-style", JC = "data-ending-style", $C = {
  [v0]: ""
}, WC = {
  [JC]: ""
}, Qi = {
  transitionStatus(l) {
    return l === "starting" ? $C : l === "ending" ? WC : null;
  }
}, eR = "data-open", tR = "data-closed", Zs = v0, nR = "data-panel-open", lR = {
  [eR]: ""
}, aR = {
  [tR]: ""
}, iR = {
  open(l) {
    return l ? {
      [nR]: ""
    } : null;
  }
}, oR = {
  open(l) {
    return l ? lR : aR;
  }
}, rR = "data-index", Dc = {
  ...oR,
  index: (l) => ({
    [rR]: String(l)
  }),
  ...Qi,
  value: () => null
}, uR = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    className: s,
    disabled: c = !1,
    onOpenChange: f,
    render: m,
    value: v,
    style: y,
    ...h
  } = i, {
    ref: p,
    index: g
  } = Nc(), {
    disabled: x,
    handleValueChange: T,
    state: A,
    value: N
  } = Ny(), E = wl(), M = v ?? E, R = c || x, I = N.includes(M), C = Re((G, le) => {
    f?.(G, le), !le.isCanceled && T(M, G, le);
  }), z = FC({
    open: I,
    onOpenChange: C,
    disabled: R
  }), V = b.useMemo(() => ({
    ...z,
    onOpenChange: C,
    state: {
      open: z.open,
      disabled: z.disabled,
      transitionStatus: z.transitionStatus
    }
  }), [z, C]), _ = b.useMemo(() => ({
    ...A,
    hidden: !I && !z.mounted,
    index: g,
    disabled: R,
    open: I
  }), [z.mounted, R, g, I, A]), U = wl(), [j, H] = b.useState(), q = j === null ? void 0 : j ?? U, $ = b.useMemo(() => ({
    defaultTriggerId: U,
    open: I,
    state: _,
    setTriggerId: H,
    triggerId: q
  }), [U, I, _, H, q]), Z = Tt("div", i, {
    state: _,
    ref: [r, p],
    props: h,
    stateAttributesMapping: Dc
  });
  return /* @__PURE__ */ w.jsx(ky.Provider, {
    value: V,
    children: /* @__PURE__ */ w.jsx(Ky.Provider, {
      value: $,
      children: Z
    })
  });
}), sR = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    ...m
  } = i, {
    state: v
  } = p0();
  return Tt("h3", i, {
    state: v,
    ref: r,
    props: m,
    stateAttributesMapping: Dc
  });
});
function zc() {
  return typeof window < "u";
}
function $n(l) {
  return b0(l) ? (l.nodeName || "").toLowerCase() : "#document";
}
function mn(l) {
  var i;
  return (l == null || (i = l.ownerDocument) == null ? void 0 : i.defaultView) || window;
}
function di(l) {
  var i;
  return (i = (b0(l) ? l.ownerDocument : l.document) || window.document) == null ? void 0 : i.documentElement;
}
function b0(l) {
  return zc() ? l instanceof Node || l instanceof mn(l).Node : !1;
}
function kn(l) {
  return zc() ? l instanceof Element || l instanceof mn(l).Element : !1;
}
function kt(l) {
  return zc() ? l instanceof HTMLElement || l instanceof mn(l).HTMLElement : !1;
}
function Mo(l) {
  return !zc() || typeof ShadowRoot > "u" ? !1 : l instanceof ShadowRoot || l instanceof mn(l).ShadowRoot;
}
function Nu(l) {
  const {
    overflow: i,
    overflowX: r,
    overflowY: s,
    display: c
  } = Ml(l);
  return /auto|scroll|overlay|hidden|clip/.test(i + s + r) && c !== "inline" && c !== "contents";
}
function cR(l) {
  return /^(table|td|th)$/.test($n(l));
}
function _c(l) {
  try {
    if (l.matches(":popover-open"))
      return !0;
  } catch {
  }
  try {
    return l.matches(":modal");
  } catch {
    return !1;
  }
}
const fR = /transform|translate|scale|rotate|perspective|filter/, dR = /paint|layout|strict|content/, Eo = (l) => !!l && l !== "none";
let Tm;
function y0(l) {
  const i = kn(l) ? Ml(l) : l;
  return Eo(i.transform) || Eo(i.translate) || Eo(i.scale) || Eo(i.rotate) || Eo(i.perspective) || !x0() && (Eo(i.backdropFilter) || Eo(i.filter)) || fR.test(i.willChange || "") || dR.test(i.contain || "");
}
function mR(l) {
  let i = Ki(l);
  for (; kt(i) && !Yi(i); ) {
    if (y0(i))
      return i;
    if (_c(i))
      return null;
    i = Ki(i);
  }
  return null;
}
function x0() {
  return Tm == null && (Tm = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")), Tm;
}
function Yi(l) {
  return /^(html|body|#document)$/.test($n(l));
}
function Ml(l) {
  return mn(l).getComputedStyle(l);
}
function jc(l) {
  return kn(l) ? {
    scrollLeft: l.scrollLeft,
    scrollTop: l.scrollTop
  } : {
    scrollLeft: l.scrollX,
    scrollTop: l.scrollY
  };
}
function Ki(l) {
  if ($n(l) === "html")
    return l;
  const i = (
    // Step into the shadow DOM of the parent of a slotted node.
    l.assignedSlot || // DOM Element detected.
    l.parentNode || // ShadowRoot detected.
    Mo(l) && l.host || // Fallback.
    di(l)
  );
  return Mo(i) ? i.host : i;
}
function Py(l) {
  const i = Ki(l);
  return Yi(i) ? (l.ownerDocument || l).body : kt(i) && Nu(i) ? i : Py(i);
}
function Cr(l, i, r) {
  var s;
  i === void 0 && (i = []), r === void 0 && (r = !0);
  const c = Py(l), f = c === ((s = l.ownerDocument) == null ? void 0 : s.body), m = mn(c);
  if (f) {
    const v = Km(m);
    return i.concat(m, m.visualViewport || [], Nu(c) ? c : [], v && r ? Cr(v) : []);
  } else
    return i.concat(c, Cr(c, [], r));
}
function Km(l) {
  return l.parent && Object.getPrototypeOf(l.parent) ? l.frameElement : null;
}
const Qy = /* @__PURE__ */ b.createContext(void 0);
function S0(l = !1) {
  const i = b.useContext(Qy);
  if (i === void 0 && !l)
    throw new Error(Rn(16));
  return i;
}
function gR(l) {
  const {
    focusableWhenDisabled: i,
    disabled: r,
    composite: s = !1,
    tabIndex: c = 0,
    isNativeButton: f
  } = l, m = s && i !== !1, v = s && i === !1;
  return {
    props: b.useMemo(() => {
      const h = {
        // allow Tabbing away from focusableWhenDisabled elements
        onKeyDown(p) {
          r && i && p.key !== "Tab" && p.preventDefault();
        }
      };
      return s || (h.tabIndex = c, !f && r && (h.tabIndex = i ? c : -1)), (f && (i || m) || !f && r) && (h["aria-disabled"] = r), f && (!i || v) && (h.disabled = r), h;
    }, [s, r, i, m, v, f, c])
  };
}
function Qt(l) {
  return l?.ownerDocument || document;
}
function ic(l, i, {
  detail: r = 0,
  pointerType: s = ""
} = {}) {
  l.dispatchEvent(new (mn(l)).PointerEvent("click", {
    bubbles: !0,
    cancelable: !0,
    composed: !0,
    detail: r,
    pointerType: s,
    shiftKey: i.shiftKey,
    ctrlKey: i.ctrlKey,
    altKey: i.altKey,
    metaKey: i.metaKey
  }));
}
function Ua(l = {}) {
  const {
    disabled: i = !1,
    focusableWhenDisabled: r,
    tabIndex: s = 0,
    native: c = !0,
    composite: f
  } = l, m = b.useRef(null), v = S0(!0), y = f ?? v !== void 0, {
    props: h
  } = gR({
    focusableWhenDisabled: r,
    disabled: i,
    composite: y,
    tabIndex: s,
    isNativeButton: c
  }), p = b.useCallback(() => {
    const T = m.current;
    Am(T) && y && i && h.disabled === void 0 && T.disabled && (T.disabled = !1);
  }, [i, h.disabled, y]);
  Te(p, [p]);
  const g = b.useCallback((T = {}) => {
    const {
      onClick: A,
      onMouseDown: N,
      onKeyUp: E,
      onKeyDown: M,
      onPointerDown: R,
      ...I
    } = T;
    return Ao({
      onClick(C) {
        if (i) {
          C.preventDefault();
          return;
        }
        A?.(C);
      },
      onMouseDown(C) {
        i || N?.(C);
      },
      onKeyDown(C) {
        if (i || (dc(C), M?.(C), C.baseUIHandlerPrevented))
          return;
        const z = C.target === C.currentTarget, V = C.currentTarget, _ = Am(V), U = !c && hR(V), j = z && (c ? _ : !U), H = C.key === "Enter", q = C.key === " ", $ = V.getAttribute("role"), Z = $?.startsWith("menuitem") || $ === "option" || $ === "gridcell";
        if (z && y && q) {
          if (C.defaultPrevented && Z)
            return;
          C.preventDefault(), (!c || _) && (C.preventBaseUIHandler(), ic(V, C));
          return;
        }
        if (!j || c || !q && !H) {
          z && U && q && C.preventDefault();
          return;
        }
        C.defaultPrevented || (C.preventDefault(), H && (C.preventBaseUIHandler(), ic(V, C)));
      },
      onKeyUp(C) {
        if (!i) {
          if (dc(C), E?.(C), C.target === C.currentTarget && c && y && Am(C.currentTarget) && C.key === " ") {
            C.preventDefault();
            return;
          }
          C.baseUIHandlerPrevented || C.target === C.currentTarget && !c && !y && !C.defaultPrevented && C.key === " " && (C.preventBaseUIHandler(), ic(C.currentTarget, C));
        }
      },
      onPointerDown(C) {
        if (i) {
          C.preventDefault();
          return;
        }
        R?.(C);
      }
    }, c ? {
      type: "button"
    } : {
      role: "button"
    }, h, I);
  }, [i, h, y, c]), x = Re((T) => {
    m.current = T, p();
  });
  return {
    getButtonProps: g,
    buttonRef: x
  };
}
function Am(l) {
  return kt(l) && l.tagName === "BUTTON";
}
function hR(l) {
  return kt(l) && l.tagName === "A" && !!l.href;
}
const pR = {
  ...Dc,
  ...iR
}, vR = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    disabled: s,
    className: c,
    id: f,
    render: m,
    nativeButton: v = !0,
    style: y,
    ...h
  } = i, {
    panelId: p,
    open: g,
    handleTrigger: x,
    disabled: T
  } = Xy(), A = s || T, {
    getButtonProps: N,
    buttonRef: E
  } = Ua({
    disabled: A,
    native: v
  }), {
    defaultTriggerId: M,
    state: R,
    setTriggerId: I
  } = p0(), C = f || void 0, z = C ?? M;
  return Te(() => (I((U) => C ?? (U === null ? void 0 : U)), () => {
    I((U) => U === C ? null : U);
  }), [C, I]), Tt("button", i, {
    state: R,
    ref: [r, E],
    props: [{
      "aria-controls": g ? p : void 0,
      "aria-expanded": g,
      id: z,
      onClick: x
    }, h, N],
    stateAttributesMapping: pR
  });
});
function Yt(l, i, r, s) {
  return l.addEventListener(i, r, s), () => {
    l.removeEventListener(i, r, s);
  };
}
const pu = 0;
class No {
  static create() {
    return new No();
  }
  currentId = pu;
  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  start(i, r) {
    this.clear(), this.currentId = setTimeout(() => {
      this.currentId = pu, r();
    }, i);
  }
  isStarted() {
    return this.currentId !== pu;
  }
  clear = () => {
    this.currentId !== pu && (clearTimeout(this.currentId), this.currentId = pu);
  };
  disposeEffect = () => this.clear;
}
function _a() {
  const l = fl(No.create).current;
  return Yy(l.disposeEffect), l;
}
function sl(l) {
  const i = fl(bR, l).current;
  return i.next = l, Te(i.effect), i;
}
function bR(l) {
  const i = {
    current: l,
    next: l,
    effect: () => {
      i.current = i.next;
    }
  };
  return i;
}
function ii(l) {
  return l == null ? l : "current" in l ? l.current : l;
}
function fb(l, i) {
  return l.getAnimations(i).filter((r) => {
    const s = r.effect?.getTiming();
    return s?.duration !== 1 / 0 && s?.iterations !== 1 / 0;
  });
}
let Fs = null;
function yR(l) {
  if (!Fs) {
    const i = [];
    Fs = i, queueMicrotask(() => {
      Fs = null, zo.flushSync(() => {
        for (const r of i)
          r();
      });
    });
  }
  Fs.push(l);
}
function Zy(l, i = !1, r = !1) {
  const s = Tu();
  return Re((c, f = null) => {
    s.cancel();
    const m = ii(l);
    if (m == null)
      return;
    const v = m, y = () => {
      if (!r) {
        zo.flushSync(c);
        return;
      }
      yR(() => {
        f?.aborted || c();
      });
    };
    if (typeof v.getAnimations != "function" || globalThis.BASE_UI_ANIMATIONS_DISABLED) {
      c();
      return;
    }
    function h() {
      Promise.all(fb(v).map((p) => p.finished.then(zt))).then(() => {
        f?.aborted || y();
      }, () => {
        if (f?.aborted)
          return;
        if (fb(v).some((g) => g.pending || g.playState !== "finished")) {
          h();
          return;
        }
        y();
      });
    }
    if (i) {
      const p = v0;
      if (!v.hasAttribute(p)) {
        s.request(h);
        return;
      }
      const g = new MutationObserver(() => {
        v.hasAttribute(p) || (g.disconnect(), h());
      });
      g.observe(v, {
        attributes: !0,
        attributeFilter: [p]
      }), f?.addEventListener("abort", () => g.disconnect(), {
        once: !0
      });
      return;
    }
    s.request(h);
  });
}
function Zi(l) {
  const {
    enabled: i = !0,
    open: r,
    ref: s,
    batch: c = !1,
    onComplete: f
  } = l, m = Re(f), v = Zy(s, r, c);
  b.useEffect(() => {
    if (!i)
      return;
    const y = new AbortController();
    return v(m, y.signal), () => {
      y.abort();
    };
  }, [i, r, m, v]);
}
const hr = {
  height: void 0,
  width: void 0
};
function xR(l) {
  const {
    externalRef: i,
    hiddenUntilFound: r,
    id: s,
    keepMounted: c,
    mounted: f,
    onOpenChange: m,
    open: v,
    setMounted: y,
    setOpen: h,
    transitionStatus: p
  } = l, g = b.useRef(null), x = b.useRef(null), [T, A] = b.useState(hr), N = b.useRef(hr), E = b.useRef(!1), M = b.useRef(v), R = b.useRef(!1), [I, C] = b.useState(!1), z = b.useRef(null), V = da(i, g), _ = sl(v), U = Zy(g), j = !v && !f, H = I ? "idle" : p, q = v && // These 2 refs are safe to read in render, they are only written from committed
  // layout/effect paths and gate one-shot motion suppression for the next open
  // lifecycle. They intentionally expose the last committed motion snapshot.
  (M.current || R.current), $ = !v && f && // These 2 refs are also safe to read in render, both hold the last committed
  // animation mode and measurement. This fallback only restores a previously
  // measured pixel size after the live dimensions state has been reset back to `auto`.
  x.current === "css-animation" && T.height === void 0 && T.width === void 0 ? N.current : T, Z = r && j && x.current !== "css-animation", G = Re((J, te = !0) => {
    te && (N.current = J), A(J);
  }), le = Re(() => {
    z.current?.(), z.current = null;
  }), k = Re((J) => {
    le(), z.current = () => {
      z.current = null, J();
    };
  }), ie = Re(() => {
    v && f && x.current === "css-animation" && (R.current = !0);
  });
  Te(() => {
    !I || p === "starting" || C(!1);
  }, [I, p]), b.useEffect(() => () => {
    ie(), le();
  }, [ie, le]), Te(() => {
    v || (M.current = !1, R.current = !1);
    const J = g.current;
    if (!J)
      return;
    !v && z.current && le();
    const te = SR(J, q);
    if (x.current = te, v && p === "idle" && M.current && te === "css-animation") {
      N.current = pr(J);
      return;
    }
    if (v && p === "starting") {
      const ze = E.current;
      if (E.current = !1, te === "none") {
        G(pr(J)), C(!0);
        return;
      }
      if (te === "css-transition") {
        const ce = ER(J);
        if (G(pr(J)), !ze)
          return ce;
        const oe = Js(J, "transition-duration", "0s");
        return k(oe), C(!0), ce;
      }
      G(pr(J));
      const O = Js(J, "animation-name", "none");
      if (!ze) {
        O();
        return;
      }
      const B = Js(J, "animation-duration", "0s");
      O(), k(B), C(!0);
      return;
    }
    if (!v && f && (p === "idle" || p === "starting")) {
      if (te === "none") {
        G(hr, !1), y(!1);
        return;
      }
      G(pr(J));
      return;
    }
    if (p !== "ending")
      return;
    if (te === "none") {
      y(!1);
      return;
    }
    const De = pr(J);
    if (!(De.height > 0 || De.width > 0)) {
      y(!1);
      return;
    }
    G(De), te === "css-animation" && Js(J, "animation-name", "none")();
  }, [f, v, le, G, y, k, q, p]), Zi({
    enabled: v && f && H === "idle",
    open: !0,
    ref: g,
    onComplete() {
      v && G(hr, !1);
    }
  }), b.useEffect(() => {
    if (v || !f || H !== "ending")
      return;
    if (!g.current) {
      y(!1), G(hr, !1);
      return;
    }
    const te = new AbortController();
    let De = -1;
    function ge() {
      _.current || (y(!1), G(hr, !1));
    }
    return De = ul.request(() => {
      U(ge, te.signal);
    }), () => {
      ul.cancel(De), te.abort();
    };
  }, [_, f, v, H, U, G, y]), Te(() => {
    const J = g.current;
    !J || !r || !j || J.setAttribute("hidden", "until-found");
  }, [j, r]), b.useEffect(function() {
    const te = g.current;
    if (!te)
      return;
    const De = No.create();
    let ge = -1;
    const ze = (ce, oe) => {
      De.start(0, () => {
        _.current || (ge = ul.request(() => {
          _.current || (ce && (E.current = !1), oe && te.setAttribute(Zs, ""), te.setAttribute("hidden", "until-found"));
        }));
      });
    }, B = Yt(te, "beforematch", (ce) => {
      const oe = it(Yn, ce);
      if (m(!0, oe), oe.isCanceled) {
        ze(!1, !1);
        return;
      }
      E.current = !0;
      const ye = te.hasAttribute(Zs);
      te.removeAttribute(Zs), h(!0), ze(!0, ye);
    });
    return () => {
      De.clear(), ul.cancel(ge), B();
    };
  }, [_, m, h]);
  const P = c || r || f || v;
  return {
    height: $.height,
    props: {
      ...Z ? {
        [Zs]: ""
      } : void 0,
      hidden: j,
      id: s
    },
    ref: V,
    shouldPreventOpenAnimation: q,
    shouldRender: P,
    transitionStatus: H,
    width: $.width
  };
}
function pr(l) {
  return {
    height: l.scrollHeight,
    width: l.scrollWidth
  };
}
function SR(l, i) {
  const r = mn(l).getComputedStyle(l), s = (r.animationName.split(",").map((f) => f.trim()).some((f) => f !== "" && f !== "none") || i) && db(r.animationDuration), c = db(r.transitionDuration);
  return s && c || c ? "css-transition" : s ? "css-animation" : "none";
}
function db(l) {
  return l.split(",").map((i) => i.trim()).some((i) => i !== "" && Number.parseFloat(i) > 0);
}
function Js(l, i, r) {
  const s = l.style.getPropertyValue(i), c = l.style.getPropertyPriority(i);
  return l.style.setProperty(i, r), () => {
    if (s === "") {
      l.style.removeProperty(i);
      return;
    }
    l.style.setProperty(i, s, c);
  };
}
function ER(l) {
  const i = {
    "justify-content": l.style.justifyContent,
    "align-items": l.style.alignItems,
    "align-content": l.style.alignContent,
    "justify-items": l.style.justifyItems
  };
  Object.keys(i).forEach((c) => {
    l.style.setProperty(c, "initial", "important");
  });
  function r() {
    Object.entries(i).forEach(([c, f]) => {
      if (f === "") {
        l.style.removeProperty(c);
        return;
      }
      l.style.setProperty(c, f);
    });
  }
  const s = ul.request(r);
  return () => {
    ul.cancel(s), r();
  };
}
const CR = "--accordion-panel-height", RR = "--accordion-panel-width", TR = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    className: s,
    hiddenUntilFound: c,
    keepMounted: f,
    id: m,
    render: v,
    style: y,
    ...h
  } = i, {
    hiddenUntilFound: p,
    keepMounted: g
  } = Ny(), {
    defaultPanelId: x,
    mounted: T,
    onOpenChange: A,
    open: N,
    setMounted: E,
    setOpen: M,
    setPanelIdState: R,
    transitionStatus: I
  } = Xy(), C = c ?? p, z = f ?? g, V = m || void 0, _ = m ?? x;
  Te(() => (R((te) => V ?? (te === null ? void 0 : te)), () => {
    R((te) => te === V ? null : te);
  }), [V, R]);
  const {
    height: U,
    props: j,
    ref: H,
    shouldPreventOpenAnimation: q,
    shouldRender: $,
    transitionStatus: Z,
    width: G
  } = xR({
    externalRef: r,
    hiddenUntilFound: C,
    id: _,
    keepMounted: z,
    mounted: T,
    onOpenChange: A,
    open: N,
    setMounted: E,
    setOpen: M,
    transitionStatus: I
  }), {
    state: le,
    triggerId: k
  } = p0(), ie = {
    ...le,
    transitionStatus: Z
  }, P = _y(y, ie), J = Tt("div", {
    ...i,
    style: void 0
  }, {
    state: ie,
    ref: H,
    props: [
      j,
      {
        "aria-labelledby": k,
        role: "region",
        style: {
          [CR]: U === void 0 ? "auto" : `${U}px`,
          [RR]: G === void 0 ? "auto" : `${G}px`
        }
      },
      h,
      P ? {
        style: P
      } : void 0,
      // Resolve the public `style` prop so temporary `animationName: 'none'`
      // can still win after user's inline styles have been merged.
      q ? {
        style: {
          animationName: "none"
        }
      } : void 0
    ],
    stateAttributesMapping: Dc
  });
  return $ ? J : null;
});
function AR({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    BC,
    {
      "data-slot": "accordion",
      className: $e("va:flex va:w-full va:flex-col", l),
      ...i
    }
  );
}
function OR({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    uR,
    {
      "data-slot": "accordion-item",
      className: $e("va:not-last:border-b", l),
      ...i
    }
  );
}
function wR({
  className: l,
  children: i,
  ...r
}) {
  return /* @__PURE__ */ w.jsx(sR, { className: "va:flex", children: /* @__PURE__ */ w.jsxs(
    vR,
    {
      "data-slot": "accordion-trigger",
      className: $e(
        "va:group/accordion-trigger va:relative va:flex va:flex-1 va:items-start va:justify-between va:rounded-lg va:border va:border-transparent va:py-2.5 va:text-left va:text-sm va:font-medium va:transition-all va:outline-none va:hover:underline va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:focus-visible:after:border-ring va:aria-disabled:pointer-events-none va:aria-disabled:opacity-50 va:**:data-[slot=accordion-trigger-icon]:ml-auto va:**:data-[slot=accordion-trigger-icon]:size-4 va:**:data-[slot=accordion-trigger-icon]:text-muted-foreground",
        l
      ),
      ...r,
      children: [
        i,
        /* @__PURE__ */ w.jsx(yy, { "data-slot": "accordion-trigger-icon", className: "va:pointer-events-none va:shrink-0 va:group-aria-expanded/accordion-trigger:hidden" }),
        /* @__PURE__ */ w.jsx(uC, { "data-slot": "accordion-trigger-icon", className: "va:pointer-events-none va:hidden va:shrink-0 va:group-aria-expanded/accordion-trigger:inline" })
      ]
    }
  ) });
}
function MR({
  className: l,
  children: i,
  ...r
}) {
  return /* @__PURE__ */ w.jsx(
    TR,
    {
      "data-slot": "accordion-content",
      className: "va:overflow-hidden va:text-sm va:data-open:animate-accordion-down va:data-closed:animate-accordion-up",
      ...r,
      children: /* @__PURE__ */ w.jsx(
        "div",
        {
          className: $e(
            "va:h-(--accordion-panel-height) va:pt-0 va:pb-2.5 va:data-ending-style:h-0 va:data-starting-style:h-0 va:[&_a]:underline va:[&_a]:underline-offset-3 va:[&_a]:hover:text-foreground va:[&_p:not(:last-child)]:mb-4",
            l
          ),
          children: i
        }
      )
    }
  );
}
function NR(l) {
  return Tt(l.defaultTagName ?? "div", l, l);
}
function Fy(l) {
  var i, r, s = "";
  if (typeof l == "string" || typeof l == "number") s += l;
  else if (typeof l == "object") if (Array.isArray(l)) {
    var c = l.length;
    for (i = 0; i < c; i++) l[i] && (r = Fy(l[i])) && (s && (s += " "), s += r);
  } else for (r in l) l[r] && (s && (s += " "), s += r);
  return s;
}
function DR() {
  for (var l, i, r = 0, s = "", c = arguments.length; r < c; r++) (l = arguments[r]) && (i = Fy(l)) && (s && (s += " "), s += i);
  return s;
}
const mb = (l) => typeof l == "boolean" ? `${l}` : l === 0 ? "0" : l, gb = DR, Ar = (l, i) => (r) => {
  var s;
  if (i?.variants == null) return gb(l, r?.class, r?.className);
  const { variants: c, defaultVariants: f } = i, m = Object.keys(c).map((h) => {
    const p = r?.[h], g = f?.[h];
    if (p === null) return null;
    const x = mb(p) || mb(g);
    return c[h][x];
  }), v = r && Object.entries(r).reduce((h, p) => {
    let [g, x] = p;
    return x === void 0 || (h[g] = x), h;
  }, {}), y = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((h, p) => {
    let { class: g, className: x, ...T } = p;
    return Object.entries(T).every((A) => {
      let [N, E] = A;
      return Array.isArray(E) ? E.includes({
        ...f,
        ...v
      }[N]) : {
        ...f,
        ...v
      }[N] === E;
    }) ? [
      ...h,
      g,
      x
    ] : h;
  }, []);
  return gb(l, m, y, r?.class, r?.className);
}, zR = Ar(
  "va:group/badge va:inline-flex va:h-5 va:w-fit va:shrink-0 va:items-center va:justify-center va:gap-1 va:overflow-hidden va:rounded-4xl va:border va:border-transparent va:px-2 va:py-0.5 va:text-xs va:font-medium va:whitespace-nowrap va:transition-all va:focus-visible:border-ring va:focus-visible:ring-[3px] va:focus-visible:ring-ring/50 va:has-data-[icon=inline-end]:pr-1.5 va:has-data-[icon=inline-start]:pl-1.5 va:aria-invalid:border-destructive va:aria-invalid:ring-destructive/20 va:dark:aria-invalid:ring-destructive/40 va:[&>svg]:pointer-events-none va:[&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "va:bg-primary va:text-primary-foreground va:[a]:hover:bg-primary/80",
        secondary: "va:bg-secondary va:text-secondary-foreground va:[a]:hover:bg-secondary/80",
        destructive: "va:bg-destructive/10 va:text-destructive va:focus-visible:ring-destructive/20 va:dark:bg-destructive/20 va:dark:focus-visible:ring-destructive/40 va:[a]:hover:bg-destructive/20",
        outline: "va:border-border va:text-foreground va:[a]:hover:bg-muted va:[a]:hover:text-muted-foreground",
        ghost: "va:hover:bg-muted va:hover:text-muted-foreground va:dark:hover:bg-muted/50",
        link: "va:text-primary va:underline-offset-4 va:hover:underline"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function vr({
  className: l,
  variant: i = "default",
  render: r,
  ...s
}) {
  return NR({
    defaultTagName: "span",
    props: Ao(
      {
        className: $e(zR({ variant: i }), l)
      },
      s
    ),
    render: r,
    state: {
      slot: "badge",
      variant: i
    }
  });
}
const _R = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    disabled: f = !1,
    focusableWhenDisabled: m = !1,
    nativeButton: v = !0,
    style: y,
    ...h
  } = i, {
    getButtonProps: p,
    buttonRef: g
  } = Ua({
    disabled: f,
    focusableWhenDisabled: m,
    native: v
  });
  return Tt("button", i, {
    state: {
      disabled: f
    },
    ref: [r, g],
    props: [h, p]
  });
}), jR = Ar(
  "va:group/button va:inline-flex va:shrink-0 va:items-center va:justify-center va:rounded-lg va:border va:border-transparent va:bg-clip-padding va:text-sm va:font-medium va:whitespace-nowrap va:transition-all va:outline-none va:select-none va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:active:not-aria-[haspopup]:translate-y-px va:disabled:pointer-events-none va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40 va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        equip: "armory-equip-button va:bg-accent va:text-accent-foreground va:hover:bg-accent/90",
        default: "va:bg-primary va:text-primary-foreground va:hover:bg-primary/80",
        outline: "va:border-border va:bg-background va:hover:bg-muted va:hover:text-foreground va:aria-expanded:bg-muted va:aria-expanded:text-foreground va:dark:border-input va:dark:bg-input/30 va:dark:hover:bg-input/50",
        secondary: "va:bg-secondary va:text-secondary-foreground va:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] va:aria-expanded:bg-secondary va:aria-expanded:text-secondary-foreground",
        ghost: "va:hover:bg-muted va:hover:text-foreground va:aria-expanded:bg-muted va:aria-expanded:text-foreground va:dark:hover:bg-muted/50",
        destructive: "va:bg-destructive/10 va:text-destructive va:hover:bg-destructive/20 va:focus-visible:border-destructive/40 va:focus-visible:ring-destructive/20 va:dark:bg-destructive/20 va:dark:hover:bg-destructive/30 va:dark:focus-visible:ring-destructive/40",
        link: "va:text-primary va:underline-offset-4 va:hover:underline"
      },
      size: {
        default: "va:h-8 va:gap-1.5 va:px-2.5 va:has-data-[icon=inline-end]:pr-2 va:has-data-[icon=inline-start]:pl-2",
        xs: "va:h-6 va:gap-1 va:rounded-[min(var(--radius-md),10px)] va:px-2 va:text-xs va:in-data-[slot=button-group]:rounded-lg va:has-data-[icon=inline-end]:pr-1.5 va:has-data-[icon=inline-start]:pl-1.5 va:[&_svg:not([class*=size-])]:size-3",
        sm: "va:h-7 va:gap-1 va:rounded-[min(var(--radius-md),12px)] va:px-2.5 va:text-[0.8rem] va:in-data-[slot=button-group]:rounded-lg va:has-data-[icon=inline-end]:pr-1.5 va:has-data-[icon=inline-start]:pl-1.5 va:[&_svg:not([class*=size-])]:size-3.5",
        lg: "va:h-9 va:gap-1.5 va:px-2.5 va:has-data-[icon=inline-end]:pr-2 va:has-data-[icon=inline-start]:pl-2",
        icon: "va:size-8",
        "icon-xs": "va:size-6 va:rounded-[min(var(--radius-md),10px)] va:in-data-[slot=button-group]:rounded-lg va:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "va:size-7 va:rounded-[min(var(--radius-md),12px)] va:in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "va:size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function za({
  className: l,
  variant: i = "default",
  type: r = "button",
  size: s = "default",
  ...c
}) {
  return /* @__PURE__ */ w.jsx(
    _R,
    {
      "data-slot": "button",
      type: r,
      className: $e(jR({ variant: i, size: s, className: l })),
      ...c
    }
  );
}
function E0({
  className: l,
  size: i = "default",
  variant: r = "default",
  ...s
}) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "card",
      "data-size": i,
      "data-variant": r,
      className: $e(
        "va:group/card va:flex va:flex-col va:gap-(--card-spacing) va:overflow-hidden va:rounded-xl va:bg-card va:py-(--card-spacing) va:text-sm va:text-card-foreground va:ring-1 va:ring-foreground/10 va:[--card-spacing:--spacing(4)] va:has-data-[slot=card-footer]:pb-0 va:has-[>img:first-child]:pt-0 va:data-[size=sm]:[--card-spacing:--spacing(3)] va:data-[size=sm]:has-data-[slot=card-footer]:pb-0 va:*:[img:first-child]:rounded-t-xl va:*:[img:last-child]:rounded-b-xl",
        r !== "default" && "armory-card",
        l
      ),
      ...s
    }
  );
}
function C0({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "card-header",
      className: $e(
        "va:group/card-header va:@container/card-header va:grid va:auto-rows-min va:items-start va:gap-1 va:rounded-t-xl va:px-(--card-spacing) va:has-data-[slot=card-action]:grid-cols-[1fr_auto] va:has-data-[slot=card-description]:grid-rows-[auto_auto] va:[.border-b]:pb-(--card-spacing)",
        l
      ),
      ...i
    }
  );
}
function R0({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "card-title",
      className: $e(
        "va:text-base va:leading-snug va:font-medium va:group-data-[size=sm]/card:text-sm",
        l
      ),
      ...i
    }
  );
}
function mc({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "card-description",
      className: $e("va:text-sm va:text-muted-foreground", l),
      ...i
    }
  );
}
function T0({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "card-content",
      className: $e("va:px-(--card-spacing)", l),
      ...i
    }
  );
}
function A0({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "card-footer",
      className: $e(
        "va:flex va:items-center va:rounded-b-xl va:border-t va:bg-muted/50 va:p-(--card-spacing)",
        l
      ),
      ...i
    }
  );
}
function HR() {
  return typeof navigator > "u" ? {
    userAgent: "",
    platform: "",
    maxTouchPoints: 0
  } : {
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0
  };
}
const {
  userAgent: UR,
  platform: IR,
  maxTouchPoints: VR
} = HR(), Hc = UR.toLowerCase(), Au = IR.toLowerCase(), Du = /^i(os$|p)/.test(Au) || Au === "macintel" && VR > 1, hb = "android", gc = Au === hb || Hc.includes(hb), LR = !Du && Au.startsWith("mac");
Au.startsWith("win");
const BR = LR || Du, _o = typeof CSS < "u" && !!CSS.supports?.("-webkit-backdrop-filter:none"), pb = !_o && Hc.includes("firefox");
!_o && Hc.includes("chrom");
const qR = BR, Jy = /jsdom|happydom/.test(Hc);
let vb = {}, bb = {}, yb = "";
function Uc(l, i) {
  return Nu(l) ? l : i;
}
function xb(l, i, r) {
  return /hidden|clip/.test(l.getComputedStyle(Uc(i, r)).overflowY);
}
function GR(l) {
  if (typeof document > "u")
    return !1;
  const i = Qt(l);
  return mn(i).innerWidth - i.documentElement.clientWidth > 0;
}
function YR(l) {
  if (!(typeof CSS < "u" && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) || typeof document > "u")
    return !1;
  const r = Qt(l), s = r.documentElement, c = r.body, f = Uc(s, c), m = f.style.overflowY, v = s.style.scrollbarGutter;
  s.style.scrollbarGutter = "stable", f.style.overflowY = "scroll";
  const y = f.offsetWidth;
  f.style.overflowY = "hidden";
  const h = f.offsetWidth;
  return f.style.overflowY = m, s.style.scrollbarGutter = v, y === h;
}
function kR(l) {
  const i = Qt(l), r = i.documentElement, s = i.body, c = Uc(r, s), f = {
    overflowY: c.style.overflowY,
    overflowX: c.style.overflowX
  };
  return Object.assign(c.style, {
    overflowY: "hidden",
    overflowX: "hidden"
  }), () => {
    Object.assign(c.style, f);
  };
}
function XR(l) {
  const i = Qt(l), r = i.documentElement, s = i.body, c = mn(r);
  let f = 0, m = 0, v = !1;
  const y = ul.create();
  if (_o && (c.visualViewport?.scale ?? 1) !== 1)
    return () => {
    };
  function h() {
    const T = c.getComputedStyle(r), A = c.getComputedStyle(s), M = (T.scrollbarGutter || "").includes("both-edges") ? "stable both-edges" : "stable";
    f = r.scrollTop, m = r.scrollLeft, vb = {
      scrollbarGutter: r.style.scrollbarGutter,
      overflowY: r.style.overflowY,
      overflowX: r.style.overflowX
    }, yb = r.style.scrollBehavior, bb = {
      position: s.style.position,
      height: s.style.height,
      width: s.style.width,
      boxSizing: s.style.boxSizing,
      overflowY: s.style.overflowY,
      overflowX: s.style.overflowX,
      scrollBehavior: s.style.scrollBehavior
    };
    const R = r.scrollHeight > r.clientHeight, I = r.scrollWidth > r.clientWidth, C = T.overflowY === "scroll" || A.overflowY === "scroll", z = T.overflowX === "scroll" || A.overflowX === "scroll", V = Math.max(0, c.innerWidth - s.clientWidth), _ = Math.max(0, c.innerHeight - s.clientHeight), U = parseFloat(A.marginTop) + parseFloat(A.marginBottom), j = parseFloat(A.marginLeft) + parseFloat(A.marginRight), H = Uc(r, s);
    if (v = YR(l), v) {
      r.style.scrollbarGutter = M, H.style.overflowY = "hidden", H.style.overflowX = "hidden";
      return;
    }
    Object.assign(r.style, {
      scrollbarGutter: M,
      overflowY: "hidden",
      overflowX: "hidden"
    }), (R || C) && (r.style.overflowY = "scroll"), (I || z) && (r.style.overflowX = "scroll"), Object.assign(s.style, {
      position: "relative",
      height: U || _ ? `calc(100dvh - ${U + _}px)` : "100dvh",
      width: j || V ? `calc(100vw - ${j + V}px)` : "100vw",
      boxSizing: "border-box",
      // Assign the longhands that `cleanup` restores, so nothing is left behind.
      overflowY: "hidden",
      overflowX: "hidden",
      scrollBehavior: "unset"
    }), s.scrollTop = f, s.scrollLeft = m, r.setAttribute("data-base-ui-scroll-locked", ""), r.style.scrollBehavior = "unset";
  }
  function p() {
    Object.assign(r.style, vb), Object.assign(s.style, bb), v || (r.scrollTop = f, r.scrollLeft = m, r.removeAttribute("data-base-ui-scroll-locked"), r.style.scrollBehavior = yb);
  }
  function g() {
    p(), y.request(h);
  }
  h();
  const x = Yt(c, "resize", g);
  return () => {
    y.cancel(), p(), typeof c.removeEventListener == "function" && x();
  };
}
class KR {
  lockCount = 0;
  restore = null;
  timeoutLock = No.create();
  timeoutUnlock = No.create();
  acquire(i) {
    return this.lockCount += 1, this.lockCount === 1 && this.restore === null && this.timeoutLock.start(0, () => this.lock(i)), this.release;
  }
  release = () => {
    this.lockCount -= 1, this.lockCount === 0 && this.restore && this.timeoutUnlock.start(0, this.unlock);
  };
  unlock = () => {
    this.lockCount === 0 && this.restore && (this.restore?.(), this.restore = null);
  };
  lock(i) {
    if (this.lockCount === 0 || this.restore !== null)
      return;
    const r = Qt(i), s = r.documentElement, c = r.body, f = mn(s);
    if (xb(f, s, c)) {
      const v = new f.MutationObserver(() => {
        xb(f, s, c) || (v.disconnect(), this.restore = null, this.lock(i));
      }), y = {
        attributes: !0
      };
      v.observe(s, y), v.observe(c, y), this.restore = () => v.disconnect();
      return;
    }
    const m = Du || !GR(i);
    this.restore = m ? kR(i) : XR(i);
  }
}
const PR = new KR();
function $y(l = !0, i = null) {
  Te(() => {
    if (l)
      return PR.acquire(i);
  }, [l, i]);
}
function zn(l) {
  l.preventDefault(), l.stopPropagation();
}
function QR(l) {
  return "nativeEvent" in l;
}
function Ou(l) {
  return l.pointerType === "" && l.isTrusted ? !0 : gc && l.pointerType ? l.type === "click" && l.buttons === 1 : l.detail === 0 && !l.pointerType;
}
function O0(l) {
  return Jy ? !1 : !gc && l.width === 0 && l.height === 0 || // Chrome synthesizes a screen reader press (TalkBack, VoiceOver, NVDA) as a 1x1 mouse
  // `pointerdown` with no pressure. TalkBack can report a pressed button, while desktop
  // mouse presses can report no pressure, so only require no pressed button off Android.
  l.type === "pointerdown" && l.width === 1 && l.height === 1 && l.pressure === 0 && l.detail === 0 && l.pointerType === "mouse" && (gc || l.buttons === 0) || // iOS VoiceOver returns 0.333• for width/height.
  l.width < 1 && l.height < 1 && l.pressure === 0 && l.detail === 0 && l.pointerType === "touch";
}
function Om(l, i) {
  return ["mouse", "pen"].includes(l);
}
function ZR(l) {
  const i = l.type;
  return i === "click" || i === "mousedown" || i === "keydown" || i === "keyup";
}
function Ol(l) {
  let i = l.activeElement;
  for (; i?.shadowRoot?.activeElement != null; )
    i = i.shadowRoot.activeElement;
  return i;
}
function et(l, i) {
  if (!l || !i)
    return !1;
  const r = i.getRootNode?.();
  if (l.contains(i))
    return !0;
  if (r && Mo(r)) {
    let s = i;
    for (; s; ) {
      if (l === s)
        return !0;
      s = s.parentNode || s.host;
    }
  }
  return !1;
}
function hc(l, i) {
  let r = l;
  for (; r; ) {
    if (kn(r) && r.matches(i))
      return r;
    r = r.assignedSlot ?? r.parentNode ?? (Mo(r) ? r.host : null);
  }
  return null;
}
function cl(l) {
  return "composedPath" in l ? l.composedPath()[0] ?? l.target : l.target;
}
const Pm = "data-base-ui-focusable", FR = "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])", Oo = "ArrowLeft", wo = "ArrowRight", w0 = "ArrowUp", Ic = "ArrowDown", JR = "data-open", $R = "data-closed", WR = "data-anchor-hidden", Wy = "data-popup-open", eT = "data-pressed", tT = {
  [Wy]: ""
}, nT = {
  [Wy]: "",
  [eT]: ""
}, lT = {
  [JR]: ""
}, aT = {
  [$R]: ""
}, iT = {
  [WR]: ""
}, e2 = {
  open(l) {
    return l ? tT : null;
  }
}, oT = {
  open(l) {
    return l ? nT : null;
  }
}, Vc = {
  open(l) {
    return l ? lT : aT;
  },
  anchorHidden(l) {
    return l ? iT : null;
  }
}, rT = {
  ...Vc,
  ...Qi
};
function wm(l, i) {
  if (i == null)
    return !1;
  if ("composedPath" in l)
    return l.composedPath().includes(i);
  const r = l;
  return r.target != null && i.contains(r.target);
}
function uT(l) {
  return l.matches("html,body");
}
function Lc(l) {
  return kt(l) && l.matches(FR);
}
function Qm(l) {
  return l ? l.getAttribute("role") === "combobox" && Lc(l) : !1;
}
function Zm(l) {
  return l ? l.hasAttribute(Pm) ? l : l.querySelector(`[${Pm}]`) || l : null;
}
function yr(...l) {
  return () => {
    for (let i = 0; i < l.length; i += 1) {
      const r = l[i];
      r && r();
    }
  };
}
const t2 = {
  clipPath: "inset(50%)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  margin: -1
}, M0 = {
  ...t2,
  position: "fixed",
  margin: 0,
  top: 0,
  left: 0
}, N0 = {
  ...t2,
  position: "absolute"
}, pc = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const [s, c] = b.useState();
  Te(() => {
    qR && _o && c("button");
  }, []);
  const f = {
    tabIndex: 0,
    // Role is only for VoiceOver
    role: s
  };
  return /* @__PURE__ */ w.jsx("span", {
    ...i,
    ref: r,
    style: M0,
    "aria-hidden": s ? void 0 : !0,
    ...f,
    "data-base-ui-focus-guard": ""
  });
}), Rr = Math.min, ri = Math.max, vc = Math.round, Ro = Math.floor, ui = (l) => ({
  x: l,
  y: l
}), sT = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function n2(l, i, r) {
  return ri(l, Rr(i, r));
}
function Pi(l, i) {
  return typeof l == "function" ? l(i) : l;
}
function Ll(l) {
  return l.split("-")[0];
}
function ja(l) {
  return l.split("-")[1];
}
function D0(l) {
  return l === "x" ? "y" : "x";
}
function z0(l) {
  return l === "y" ? "height" : "width";
}
function $l(l) {
  const i = l[0];
  return i === "t" || i === "b" ? "y" : "x";
}
function _0(l) {
  return D0($l(l));
}
function cT(l, i, r) {
  r === void 0 && (r = !1);
  const s = ja(l), c = _0(l), f = z0(c);
  let m = c === "x" ? s === (r ? "end" : "start") ? "right" : "left" : s === "start" ? "bottom" : "top";
  return i.reference[f] > i.floating[f] && (m = bc(m)), [m, bc(m)];
}
function fT(l) {
  const i = bc(l);
  return [Fm(l), i, Fm(i)];
}
function Fm(l) {
  return l.includes("start") ? l.replace("start", "end") : l.replace("end", "start");
}
const Sb = ["left", "right"], Eb = ["right", "left"], dT = ["top", "bottom"], mT = ["bottom", "top"];
function gT(l, i, r) {
  switch (l) {
    case "top":
    case "bottom":
      return r ? i ? Eb : Sb : i ? Sb : Eb;
    case "left":
    case "right":
      return i ? dT : mT;
    default:
      return [];
  }
}
function hT(l, i, r, s) {
  const c = ja(l);
  let f = gT(Ll(l), r === "start", s);
  return c && (f = f.map((m) => m + "-" + c), i && (f = f.concat(f.map(Fm)))), f;
}
function bc(l) {
  const i = Ll(l);
  return sT[i] + l.slice(i.length);
}
function pT(l) {
  var i, r, s, c;
  return {
    top: (i = l.top) != null ? i : 0,
    right: (r = l.right) != null ? r : 0,
    bottom: (s = l.bottom) != null ? s : 0,
    left: (c = l.left) != null ? c : 0
  };
}
function l2(l) {
  return typeof l != "number" ? pT(l) : {
    top: l,
    right: l,
    bottom: l,
    left: l
  };
}
function yc(l) {
  const {
    x: i,
    y: r,
    width: s,
    height: c
  } = l;
  return {
    width: s,
    height: c,
    top: r,
    left: i,
    right: i + s,
    bottom: r + c,
    x: i,
    y: r
  };
}
function $s(l, i, r) {
  return Math.floor(l / i) !== r;
}
function si(l, i) {
  return i < 0 || i >= l.length;
}
function oc(l, i) {
  return bl(l.current, {
    disabledIndices: i
  });
}
function Jm(l, i) {
  return bl(l.current, {
    decrement: !0,
    startingIndex: l.current.length,
    disabledIndices: i
  });
}
function vT(l, i, r) {
  const {
    decrement: s,
    loopFocus: c,
    allowEscape: f,
    disabledIndices: m,
    minIndex: v,
    maxIndex: y
  } = r, h = () => bl(l, {
    startingIndex: i,
    decrement: s,
    disabledIndices: m
  });
  let p, g = !1;
  if (!c)
    p = s ? Math.max(v, h()) : Math.min(y, h());
  else if (s ? i <= v : i >= y) {
    const x = s ? -1 : l.length;
    f && i !== x ? p = -1 : (p = s ? y : v, g = !0);
  } else
    p = h();
  return {
    index: si(l, p) ? -1 : p,
    wrapped: g
  };
}
function bl(l, {
  startingIndex: i = -1,
  decrement: r = !1,
  disabledIndices: s,
  amount: c = 1
} = {}) {
  let f = i;
  do
    f += r ? -c : c;
  while (f >= 0 && f <= l.length - 1 && ki(l, f, s));
  return f;
}
function bT(l, {
  event: i,
  orientation: r,
  loopFocus: s,
  onLoop: c,
  rtl: f,
  cols: m,
  disabledIndices: v,
  minIndex: y,
  maxIndex: h,
  prevIndex: p,
  stopEvent: g = !1
}) {
  let x = p, T;
  if (i.key === w0 ? T = "up" : i.key === Ic && (T = "down"), T) {
    const A = [], N = [];
    let E = !1, M = 0;
    {
      let j = null, H = -1;
      l.forEach((q, $) => {
        if (q == null)
          return;
        M += 1;
        const Z = hc(q, '[role="row"]');
        Z && (E = !0), (Z !== j || H === -1) && (j = Z, H += 1, A[H] = []), A[H].push($), N[$] = H;
      });
    }
    let R = !1, I = 0;
    if (E)
      for (const j of A) {
        const H = j.length;
        H > I && (I = H), H !== m && (R = !0);
      }
    const C = R && M < l.length, z = I || m, V = (j) => {
      if (!R || p === -1)
        return;
      const H = N[p];
      if (H == null)
        return;
      const q = A[H].indexOf(p), $ = j === "up" ? -1 : 1;
      for (let Z = H + $, G = 0; G < A.length; G += 1, Z += $) {
        if (Z < 0 || Z >= A.length) {
          if (!s || C)
            return;
          if (Z = Z < 0 ? A.length - 1 : 0, c) {
            const k = Math.min(q, A[Z].length - 1), ie = A[Z][k] ?? A[Z][0], P = c(i, p, ie);
            Z = N[P] ?? Z;
          }
        }
        const le = A[Z];
        for (let k = Math.min(q, le.length - 1); k >= 0; k -= 1) {
          const ie = le[k];
          if (!ki(l, ie, v))
            return ie;
        }
      }
    }, _ = (j) => {
      if (!C || p === -1)
        return;
      const H = p % z, q = j === "up" ? -z : z, $ = h - h % z, Z = Ro(h / z) + 1;
      for (let G = p - H + q, le = 0; le < Z; le += 1, G += q) {
        if (G < 0 || G > h) {
          if (!s)
            return;
          G = G < 0 ? $ : 0;
        }
        const k = Math.min(G + z - 1, h);
        for (let ie = Math.min(G + H, k); ie >= G; ie -= 1)
          if (!ki(l, ie, v))
            return ie;
      }
    };
    g && zn(i);
    const U = V(T) ?? _(T);
    if (U !== void 0)
      x = U;
    else if (p === -1)
      x = T === "up" ? h : y;
    else if (x = bl(l, {
      startingIndex: p,
      amount: z,
      decrement: T === "up",
      disabledIndices: v
    }), s) {
      if (T === "up" && (p - z < y || x < 0)) {
        const j = p % z, H = h % z, q = h - (H - j);
        H === j ? x = h : x = H > j ? q : q - z, c && (x = c(i, p, x));
      }
      T === "down" && p + z > h && (x = bl(l, {
        startingIndex: p % z - z,
        amount: z,
        disabledIndices: v
      }), c && (x = c(i, p, x)));
    }
    si(l, x) && (x = p);
  }
  if (r === "both") {
    const A = Ro(p / m);
    i.key === (f ? Oo : wo) && (g && zn(i), p % m !== m - 1 ? (x = bl(l, {
      startingIndex: p,
      disabledIndices: v
    }), s && $s(x, m, A) && (x = bl(l, {
      startingIndex: p - p % m - 1,
      disabledIndices: v
    }), c && (x = c(i, p, x)))) : s && (x = bl(l, {
      startingIndex: p - p % m - 1,
      disabledIndices: v
    }), c && (x = c(i, p, x))), $s(x, m, A) && (x = p)), i.key === (f ? wo : Oo) && (g && zn(i), p % m !== 0 ? (x = bl(l, {
      startingIndex: p,
      decrement: !0,
      disabledIndices: v
    }), s && $s(x, m, A) && (x = bl(l, {
      startingIndex: p + (m - p % m),
      decrement: !0,
      disabledIndices: v
    }), c && (x = c(i, p, x)))) : s && (x = bl(l, {
      startingIndex: p + (m - p % m),
      decrement: !0,
      disabledIndices: v
    }), c && (x = c(i, p, x))), $s(x, m, A) && (x = p));
    const N = Ro(h / m) === A;
    si(l, x) && (s && N ? (x = i.key === (f ? wo : Oo) ? h : bl(l, {
      startingIndex: p - p % m - 1,
      disabledIndices: v
    }), c && (x = c(i, p, x))) : x = p);
  }
  return x;
}
function ki(l, i, r) {
  if (typeof r == "function" ? r(i) : r?.includes(i) ?? !1)
    return !0;
  const c = l[i];
  return c ? !Bc(c) || c.matches(":disabled") ? !0 : !r && (c.hasAttribute("disabled") || c.getAttribute("aria-disabled") === "true") : !1;
}
function yT(l) {
  return l.visibility === "hidden" || l.visibility === "collapse";
}
function Bc(l, i = l ? Ml(l) : null) {
  return !l || !l.isConnected || !i || yT(i) ? !1 : typeof l.checkVisibility == "function" ? l.checkVisibility() : i.display !== "none" && i.display !== "contents";
}
const xT = 'a[href],button,input,select,textarea,summary,details,iframe,object,embed,[tabindex],[contenteditable]:not([contenteditable="false"]),audio[controls],video[controls]';
function ST(l) {
  const i = l.assignedSlot;
  if (i)
    return i;
  if (l.parentElement)
    return l.parentElement;
  const r = l.getRootNode();
  return Mo(r) ? r.host : null;
}
function $m(l) {
  for (const i of Array.from(l.children))
    if ($n(i) === "summary")
      return i;
  return null;
}
function ET(l, i) {
  const r = $m(i);
  return !!r && (l === r || et(r, l));
}
function a2(l) {
  const i = l ? $n(l) : "";
  return l != null && l.matches(xT) && (i !== "summary" || l.parentElement != null && $n(l.parentElement) === "details" && $m(l.parentElement) === l) && (i !== "details" || $m(l) == null) && (i !== "input" || l.type !== "hidden");
}
function i2(l) {
  if (!a2(l) || !l.isConnected || l.matches(":disabled"))
    return !1;
  for (let i = l; i; i = ST(i)) {
    const r = i !== l, s = $n(i) === "slot";
    if (i.hasAttribute("inert") || r && $n(i) === "details" && !i.open && !ET(l, i) || i.hasAttribute("hidden") || !s && !CT(i, r))
      return !1;
  }
  return !0;
}
function CT(l, i) {
  const r = Ml(l);
  return i ? r.display !== "none" : Bc(l, r);
}
function o2(l) {
  const i = l.tabIndex;
  if (i < 0) {
    const r = $n(l);
    if (r === "details" || r === "audio" || r === "video" || kt(l) && l.isContentEditable)
      return 0;
  }
  return i;
}
function Mm(l) {
  if ($n(l) !== "input")
    return null;
  const i = l;
  return i.type === "radio" && i.name !== "" ? i : null;
}
function RT(l, i) {
  const r = Mm(l);
  if (!r)
    return !0;
  const s = i.find((c) => {
    const f = Mm(c);
    return f?.name === r.name && f.form === r.form && f.checked;
  });
  return s ? s === r : i.find((c) => {
    const f = Mm(c);
    return f?.name === r.name && f.form === r.form;
  }) === r;
}
function r2(l) {
  if (kt(l) && $n(l) === "slot") {
    const i = l.assignedElements({
      flatten: !0
    });
    if (i.length > 0)
      return i;
  }
  return kt(l) && l.shadowRoot ? Array.from(l.shadowRoot.children) : Array.from(l.children);
}
function u2(l, i) {
  r2(l).forEach((r) => {
    a2(r) && i.push(r), u2(r, i);
  });
}
function s2(l, i, r) {
  r2(l).forEach((s) => {
    kt(s) && s.matches(i) && r.push(s), s2(s, i, r);
  });
}
function j0(l) {
  return i2(l) && o2(l) >= 0;
}
function c2(l) {
  const i = [];
  return u2(l, i), i.filter(i2);
}
function qc(l) {
  const i = c2(l);
  return i.filter((r) => o2(r) >= 0 && RT(r, i));
}
function f2(l, i) {
  const r = qc(l), s = r.length;
  if (s === 0)
    return;
  const c = Ol(Qt(l)), f = r.indexOf(c), m = f === -1 ? i === 1 ? 0 : s - 1 : f + i;
  return r[m];
}
function d2(l) {
  return f2(Qt(l).body, 1) || l;
}
function m2(l) {
  return f2(Qt(l).body, -1) || l;
}
function Su(l, i) {
  const r = i || l.currentTarget, s = l.relatedTarget;
  return !s || !et(r, s);
}
function TT(l) {
  qc(l).forEach((r) => {
    r.dataset.tabindex = r.getAttribute("tabindex") || "", r.setAttribute("tabindex", "-1");
  });
}
function Cb(l) {
  const i = [];
  s2(l, "[data-tabindex]", i), i.forEach((r) => {
    const s = r.dataset.tabindex;
    delete r.dataset.tabindex, s ? r.setAttribute("tabindex", s) : r.removeAttribute("tabindex");
  });
}
function wu(l, i, r = !0) {
  return l.filter((c) => c.parentId === i).flatMap((c) => [...!r || c.context?.open ? [c] : [], ...wu(l, c.id, r)]);
}
function Rb(l, i) {
  let r = [], s = l.find((c) => c.id === i)?.parentId;
  for (; s; ) {
    const c = l.find((f) => f.id === s);
    s = c?.parentId, c && (r = r.concat(c));
  }
  return r;
}
function Eu(l) {
  return `data-base-ui-${l}`;
}
let Ws = 0;
function rc(l, i = {}) {
  const {
    preventScroll: r = !1,
    sync: s = !1,
    shouldFocus: c
  } = i;
  cancelAnimationFrame(Ws);
  function f() {
    c && !c() || l?.focus({
      preventScroll: r
    });
  }
  if (s)
    return f(), zt;
  const m = requestAnimationFrame(f);
  return Ws = m, () => {
    Ws === m && (cancelAnimationFrame(m), Ws = 0);
  };
}
const Tb = "data-base-ui-inert";
let vu = /* @__PURE__ */ new WeakMap(), ec = /* @__PURE__ */ new WeakSet(), bu = /* @__PURE__ */ new WeakMap(), Nm = 0;
function g2(l) {
  return l ? Mo(l) ? l.host : g2(l.parentNode) : null;
}
const Ab = (l, i) => i.map((r) => {
  if (l.contains(r))
    return r;
  const s = g2(r);
  return l.contains(s) ? s : null;
}).filter((r) => r != null), Ob = (l) => {
  const i = /* @__PURE__ */ new Set();
  return l.forEach((r) => {
    let s = r;
    for (; s && !i.has(s); )
      i.add(s), s = s.parentNode;
  }), i;
}, wb = (l, i, r) => {
  const s = [], c = (f) => {
    !f || r.has(f) || Array.from(f.children).forEach((m) => {
      $n(m) !== "script" && (i.has(m) ? c(m) : s.push(m));
    });
  };
  return c(l), s;
};
function AT(l, i, r, {
  mark: s = !0
}) {
  const c = Ab(i, l), f = s ? wb(i, Ob(c), new Set(c)) : [], m = [], v = [];
  if (r) {
    const y = Ab(i, Array.from(i.querySelectorAll("[aria-live]"))), h = c.concat(y);
    wb(i, Ob(h), new Set(h)).forEach((g) => {
      const x = g.getAttribute("aria-hidden"), T = x !== null && x !== "false", A = (vu.get(g) || 0) + 1;
      vu.set(g, A), m.push(g), A === 1 && T && ec.add(g), T || g.setAttribute("aria-hidden", "true");
    });
  }
  return s && f.forEach((y) => {
    const h = (bu.get(y) || 0) + 1;
    bu.set(y, h), v.push(y), h === 1 && y.setAttribute(Tb, "");
  }), Nm += 1, () => {
    m.forEach((y) => {
      const h = (vu.get(y) || 0) - 1;
      vu.set(y, h), h || (ec.has(y) || y.removeAttribute("aria-hidden"), ec.delete(y));
    }), s && v.forEach((y) => {
      const h = (bu.get(y) || 0) - 1;
      bu.set(y, h), h || y.removeAttribute(Tb);
    }), Nm -= 1, Nm || (vu = /* @__PURE__ */ new WeakMap(), ec = /* @__PURE__ */ new WeakSet(), bu = /* @__PURE__ */ new WeakMap());
  };
}
function Mb(l, i = {}) {
  const {
    ariaHidden: r = !1,
    mark: s = !0
  } = i, c = Qt(l[0]).body;
  return AT(l, c, r, {
    mark: s
  });
}
const OT = {
  style: {
    transition: "none"
  }
}, h2 = "data-base-ui-click-trigger", wT = {
  fallbackAxisSide: "none"
}, MT = {
  clipPath: "inset(50%)",
  position: "fixed",
  top: 0,
  left: 0
}, p2 = /* @__PURE__ */ b.createContext(null), v2 = () => b.useContext(p2), NT = Eu("portal");
function DT(l = {}) {
  const {
    ref: i,
    container: r,
    componentProps: s = un,
    elementProps: c
  } = l, f = Mc(), v = v2()?.portalNode, [y, h] = b.useState(null), [p, g] = b.useState(null), x = Re((E) => {
    E !== null && g(E);
  }), T = b.useRef(null);
  Te(() => {
    if (r === null) {
      T.current && (T.current = null, g(null), h(null));
      return;
    }
    const E = (r && (b0(r) ? r : r.current)) ?? v ?? document.body;
    if (E == null) {
      T.current && (T.current = null, g(null), h(null));
      return;
    }
    T.current !== E && (T.current = E, g(null), h(E));
  }, [r, v]);
  const A = Tt("div", s, {
    ref: [i, x],
    props: [{
      id: f,
      [NT]: ""
    }, c]
  }), N = y && A ? /* @__PURE__ */ zo.createPortal(A, y) : null;
  return {
    node: p,
    // `id` and `render` props can override or remove the generated ID. Use the exact
    // rendered value so `aria-owns` never points at an ID absent from the DOM.
    nodeId: /* @__PURE__ */ b.isValidElement(A) ? A.props.id : void 0,
    subtree: N
  };
}
const b2 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    children: m,
    container: v,
    portalOwnerRole: y,
    ...h
  } = i, {
    node: p,
    nodeId: g,
    subtree: x
  } = DT({
    container: v,
    ref: r,
    componentProps: i,
    elementProps: h
  }), T = b.useRef(null), A = b.useRef(null), N = b.useRef(null), E = b.useRef(null), [M, R] = b.useState(null), I = b.useRef(!1), C = M?.modal, z = M?.open, V = !!M && !M.modal && M.open && !!p;
  b.useEffect(() => {
    if (!p || C)
      return;
    function U(j) {
      p && j.relatedTarget && Su(j) && (j.type === "focusin" ? I.current && (Cb(p), I.current = !1) : (TT(p), I.current = !0));
    }
    return yr(Yt(p, "focusin", U, !0), Yt(p, "focusout", U, !0));
  }, [p, C]), Te(() => {
    !p || z !== !0 || !I.current || (Cb(p), I.current = !1);
  }, [z, p]);
  const _ = b.useMemo(() => ({
    beforeOutsideRef: T,
    afterOutsideRef: A,
    beforeInsideRef: N,
    afterInsideRef: E,
    portalNode: p,
    setFocusManagerState: R
  }), [p]);
  return /* @__PURE__ */ w.jsxs(b.Fragment, {
    children: [x, /* @__PURE__ */ w.jsxs(p2.Provider, {
      value: _,
      children: [V && p && /* @__PURE__ */ w.jsx(pc, {
        "data-type": "outside",
        ref: T,
        onFocus: (U) => {
          if (Su(U, p))
            N.current?.focus();
          else {
            const j = M ? M.domReference : null;
            m2(j)?.focus();
          }
        }
      }), V && p && /* @__PURE__ */ w.jsx("span", {
        role: y,
        "aria-owns": g,
        style: MT
      }), p && /* @__PURE__ */ zo.createPortal(m, p), V && p && /* @__PURE__ */ w.jsx(pc, {
        "data-type": "outside",
        ref: A,
        onFocus: (U) => {
          if (Su(U, p))
            E.current?.focus();
          else {
            const j = M ? M.domReference : null;
            d2(j)?.focus(), M?.closeOnFocusOut && M?.onOpenChange(!1, it(Ru, U.nativeEvent));
          }
        }
      })]
    })]
  });
});
function zT() {
  const l = /* @__PURE__ */ new Map();
  return {
    emit(i, r) {
      l.get(i)?.forEach((s) => s(r));
    },
    on(i, r) {
      l.has(i) || l.set(i, /* @__PURE__ */ new Set()), l.get(i).add(r);
    },
    off(i, r) {
      l.get(i)?.delete(r);
    }
  };
}
const _T = /* @__PURE__ */ b.createContext(null), jT = /* @__PURE__ */ b.createContext(null), H0 = () => b.useContext(_T)?.id || null, Gc = (l) => {
  const i = b.useContext(jT);
  return l ?? i;
};
function HT(l, i) {
  const r = mn(cl(l));
  return l instanceof r.KeyboardEvent ? "keyboard" : l instanceof r.FocusEvent ? i || "keyboard" : "pointerType" in l ? l.pointerType || (Ou(l) ? "keyboard" : i || "mouse") : "touches" in l ? "touch" : l instanceof r.MouseEvent ? i || (l.detail === 0 ? "keyboard" : "mouse") : "";
}
const Nb = 20;
let Gi = [];
function U0() {
  Gi = Gi.filter((l) => l.deref()?.isConnected);
}
function Db(l) {
  U0(), l && $n(l) !== "body" && (Gi.push(new WeakRef(l)), Gi.length > Nb && (Gi = Gi.slice(-Nb)));
}
function zb() {
  return U0(), Gi[Gi.length - 1]?.deref();
}
function UT(l) {
  return l ? j0(l) ? l : qc(l)[0] || l : null;
}
function _b(l) {
  if (l.hasAttribute("tabindex") && !l.hasAttribute("data-tabindex") || !l.getAttribute("role")?.includes("dialog"))
    return;
  const r = c2(l).filter((c) => {
    const f = c.getAttribute("data-tabindex") || "";
    return j0(c) || c.hasAttribute("data-tabindex") && !f.startsWith("-");
  }), s = l.getAttribute("tabindex");
  r.length === 0 ? s !== "0" && (l.setAttribute("tabindex", "0"), l.setAttribute("data-tabindex", "0")) : (s !== "-1" || l.hasAttribute("data-tabindex") && l.getAttribute("data-tabindex") !== "-1") && (l.setAttribute("tabindex", "-1"), l.setAttribute("data-tabindex", "-1"));
}
function y2(l) {
  const {
    context: i,
    children: r,
    disabled: s = !1,
    initialFocus: c = !0,
    returnFocus: f = !0,
    explicitReturnFocus: m,
    restoreFocus: v = !1,
    modal: y = !0,
    closeOnFocusOut: h = !0,
    openInteractionType: p = "",
    nextFocusableElement: g,
    previousFocusableElement: x,
    beforeContentFocusGuardRef: T,
    externalTree: A,
    getInsideElements: N
  } = l, E = i.useState("open"), M = i.useState("domReferenceElement"), R = i.useState("floatingElement"), {
    events: I,
    dataRef: C
  } = i.context, z = Re(() => C.current.floatingContext?.nodeId), V = c === !1, _ = Qm(M) && V, U = sl(c), j = sl(f), H = sl(m), q = sl(p), $ = sl(E), Z = Gc(A), G = v2(), le = b.useRef(!1), k = b.useRef(!1), ie = b.useRef(!1), P = b.useRef(null), J = b.useRef(""), te = b.useRef(""), De = b.useRef(null), ge = b.useRef(null), ze = da(De, T, G?.beforeInsideRef), O = da(ge, G?.afterInsideRef), B = _a(), ce = _a(), oe = Tu(), ye = G != null, de = Zm(R), Ae = Re((Ue = de) => Ue ? qc(Ue) : []), pe = Re(() => N?.().filter((Ue) => Ue != null) ?? []);
  b.useEffect(() => {
    if (s || !y)
      return;
    function Ue(Se) {
      Se.key === "Tab" && et(de, Ol(Qt(de))) && Ae().length === 0 && !_ && zn(Se);
    }
    const Le = Qt(de);
    return Yt(Le, "keydown", Ue);
  }, [s, de, y, _, Ae]), b.useEffect(() => {
    if (s || !E)
      return;
    const Ue = Qt(de);
    function Le() {
      ie.current = !1;
    }
    function Se(Ne) {
      const Ee = cl(Ne), Ye = pe(), re = et(R, Ee) || et(M, Ee) || et(G?.portalNode, Ee) || Ye.some((Me) => Me === Ee || et(Me, Ee));
      ie.current = !re, te.current = Ne.pointerType || "keyboard", hc(Ee, `[${h2}]`) && (k.current = !0, ce.start(0, () => {
        k.current = !1;
      }));
    }
    function be() {
      te.current = "keyboard";
    }
    return yr(
      Yt(Ue, "pointerdown", Se, !0),
      Yt(Ue, "pointerup", Le, !0),
      Yt(Ue, "pointercancel", Le, !0),
      Yt(Ue, "keydown", be, !0),
      // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups)
      // if the popup dismissed between pointerdown and pointerup.
      Le
    );
  }, [s, R, M, de, E, G, ce, pe]), b.useEffect(() => {
    if (s || !h)
      return;
    const Ue = Qt(de);
    function Le() {
      k.current = !0, ce.start(0, () => {
        k.current = !1;
      });
    }
    function Se(Ye) {
      const re = cl(Ye);
      j0(re) && (P.current = re);
    }
    function be(Ye) {
      const re = Ye.relatedTarget, Me = Ye.currentTarget, je = cl(Ye);
      y && re == null && je != null && et(R, je) && Db(je), queueMicrotask(() => {
        const Pe = z(), ne = i.context.triggerElements, ae = pe(), He = re?.hasAttribute(Eu("focus-guard")) && [De.current, ge.current, G?.beforeInsideRef.current, G?.afterInsideRef.current, G?.beforeOutsideRef.current, G?.afterOutsideRef.current, ii(x), ii(g)].includes(re), Ce = !(et(M, re) || et(R, re) || et(re, R) || et(G?.portalNode, re) || ae.some((Oe) => Oe === re || et(Oe, re)) || ne.hasMatchingElement((Oe) => et(Oe, re)) || He || Z && (wu(Z.nodesRef.current, Pe).find((Oe) => et(Oe.context?.elements.floating, re) || et(Oe.context?.elements.domReference, re)) || Rb(Z.nodesRef.current, Pe).find((Oe) => [Oe.context?.elements.floating, Zm(Oe.context?.elements.floating)].includes(re) || Oe.context?.elements.domReference === re)));
        if (Me === M && de && _b(de), v && Me !== M && !Bc(je) && Ol(Ue) === Ue.body) {
          if (kt(de) && (de.focus(), v === "popup")) {
            oe.request(() => {
              de.focus();
            });
            return;
          }
          const Oe = Ae(), St = P.current, Ct = (St && Oe.includes(St) ? St : null) || Oe[Oe.length - 1] || de;
          kt(Ct) && Ct.focus();
        }
        if (C.current.insideReactTree) {
          C.current.insideReactTree = !1;
          return;
        }
        (_ || !y) && re && Ce && !k.current && // Fix React 18 Strict Mode returnFocus due to double rendering.
        // For an "untrapped" typeable combobox (input role=combobox with
        // initialFocus=false), re-opening the popup and tabbing out should still close it even
        // when the previously focused element (e.g. the next tabbable outside the popup) is
        // focused again. Otherwise, the popup remains open on the second Tab sequence:
        // click input -> Tab (closes) -> click input -> Tab.
        // Allow closing when `isUntrappedTypeableCombobox` regardless of the previously focused element.
        (_ || re !== zb()) && (le.current = !0, i.setOpen(!1, it(Ru, Ye)));
      });
    }
    function Ne() {
      ie.current || (C.current.insideReactTree = !0, B.start(0, () => {
        C.current.insideReactTree = !1;
      }));
    }
    const Ee = kt(M) ? M : null;
    if (!(!R && !Ee))
      return yr(Ee && Yt(Ee, "focusout", be), Ee && Yt(Ee, "pointerdown", Le), R && Yt(R, "focusin", Se), R && Yt(R, "focusout", be), R && G && Yt(R, "focusout", Ne, !0));
  }, [s, M, R, de, y, Z, G, i, h, v, Ae, _, z, C, B, ce, oe, g, x, pe]), b.useEffect(() => {
    if (s || !R || !E)
      return;
    const Ue = Array.from(G?.portalNode?.querySelectorAll(`[${Eu("portal")}]`) || []), Se = (Z ? Rb(Z.nodesRef.current, z()) : []).find((Me) => Qm(Me.context?.elements.domReference || null))?.context?.elements.domReference, Ne = [...[R, ...Ue, De.current, ge.current, G?.beforeOutsideRef.current, G?.afterOutsideRef.current, ...pe()], Se, ii(x), ii(g), _ ? M : null].filter((Me) => Me != null), Ee = Mb(Ne, {
      ariaHidden: y || _,
      mark: !1
    }), Ye = [R, ...Ue].filter((Me) => Me != null), re = Mb(Ye);
    return () => {
      re(), Ee();
    };
  }, [E, s, M, R, y, G, _, Z, z, g, x, pe]), Te(() => {
    if (!E || s || !kt(de))
      return;
    J.current = "", te.current = "";
    const Ue = Qt(de), Le = Ol(Ue);
    queueMicrotask(() => {
      const Se = U.current, be = typeof Se == "function" ? Se(q.current || "") : Se;
      if (be === void 0 || be === !1 || et(de, Le))
        return;
      let Ee = null;
      const Ye = () => (Ee == null && (Ee = Ae(de)), Ee[0] || de);
      let re;
      be === !0 || be === null ? re = Ye() : re = ii(be), re = re || Ye();
      const Me = et(de, Ol(Ue)), je = C.current.openEvent, Pe = je?.type === "mousedown" && Ou(je);
      rc(re, {
        sync: Pe,
        preventScroll: re === de,
        shouldFocus() {
          if (!$.current)
            return !1;
          if (Me)
            return !0;
          const ne = Ol(Ue);
          return !(ne !== re && et(de, ne));
        }
      });
    });
  }, [s, E, de, Ae, U, q, $, C]);
  const xe = b.useRef(null);
  Te(() => {
    if (s || !de) {
      xe.current = null;
      return;
    }
    xe.current && (xe.current.cancelled = !0, xe.current = null);
    const Ue = Qt(de), Le = Ol(Ue), Se = q.current == null;
    Db(Le);
    function be(Ee) {
      if (Ee.open || (J.current = HT(Ee.nativeEvent, te.current)), (Ee.reason === Ru && Ee.triggerElement?.hasAttribute(Eu("focus-guard")) || Ee.reason === YC && Ee.nativeEvent.type === "mouseleave") && (le.current = !0), Ee.reason === g0)
        if (Ee.nested)
          le.current = !1;
        else if (Ou(Ee.nativeEvent) || O0(Ee.nativeEvent))
          le.current = !1;
        else {
          let Ye = !1;
          Qt(de).createElement("div").focus({
            get preventScroll() {
              return Ye = !0, !1;
            }
          }), Ye ? le.current = !1 : le.current = !0;
        }
    }
    I.on("openchange", be);
    function Ne(Ee) {
      const Ye = j.current;
      let re = typeof Ye == "function" ? Ye(Ee) : Ye;
      if (re === void 0 || re === !1)
        return null;
      re === null && (re = !0);
      const Me = M?.isConnected ? M : null, je = Le?.isConnected && $n(Le) !== "body" ? Le : null;
      let Pe = Se ? je || Me : Me || je;
      return Pe || (Pe = zb() || null), typeof re == "boolean" ? Pe : ii(re) || Pe || null;
    }
    return () => {
      I.off("openchange", be);
      const Ee = Ol(Ue), Ye = pe(), re = et(R, Ee) || Ye.some((ae) => ae === Ee || et(ae, Ee)) || Z && wu(Z.nodesRef.current, z(), !1).some((ae) => et(ae.context?.elements.floating, Ee)), Me = j.current, je = J.current, Pe = Ne(je), ne = {
        cancelled: !1
      };
      xe.current = ne, queueMicrotask(() => {
        xe.current === ne && (xe.current = null);
        const ae = UT(Pe), He = (
          // eslint-disable-next-line react-hooks/exhaustive-deps
          H.current ?? typeof Me != "boolean"
        );
        if (!ne.cancelled && Me && !le.current && kt(ae) && // If the focus moved somewhere else after mount, avoid returning focus
        // since it likely entered a different element which should be
        // respected: https://github.com/floating-ui/floating-ui/issues/2607
        (!(!He && ae !== Ee && Ee !== Ue.body) || re)) {
          const Ce = {
            preventScroll: !0
          };
          je === "keyboard" && (Ce.focusVisible = !0), ae.focus(Ce);
        }
        le.current = !1;
      });
    };
  }, [s, R, de, j, H, q, I, Z, M, z, pe]), Te(() => {
    if (!_o || E || !R)
      return;
    const Ue = Ol(Qt(R));
    !kt(Ue) || !Lc(Ue) || et(R, Ue) && Ue.blur();
  }, [E, R]), Te(() => {
    if (!(s || !G))
      return G.setFocusManagerState({
        modal: y,
        closeOnFocusOut: h,
        open: E,
        onOpenChange: i.setOpen,
        domReference: M
      }), () => {
        G.setFocusManagerState(null);
      };
  }, [s, G, y, E, i, h, M]), Te(() => {
    if (!(s || !de))
      return _b(de), () => {
        queueMicrotask(U0);
      };
  }, [s, de]);
  const Ke = !s && (y ? !_ : !0) && (ye || y);
  return /* @__PURE__ */ w.jsxs(b.Fragment, {
    children: [Ke && /* @__PURE__ */ w.jsx(pc, {
      "data-type": "inside",
      ref: ze,
      onFocus: (Ue) => {
        if (y) {
          const Le = Ae();
          rc(Le[Le.length - 1]);
        } else G?.portalNode && (le.current = !1, Su(Ue, G.portalNode) ? d2(M)?.focus() : ii(x ?? G.beforeOutsideRef)?.focus());
      }
    }), r, Ke && /* @__PURE__ */ w.jsx(pc, {
      "data-type": "inside",
      ref: O,
      onFocus: (Ue) => {
        y ? rc(Ae()[0]) : G?.portalNode && (h && (le.current = !0), Su(Ue, G.portalNode) ? m2(M)?.focus() : ii(g ?? G.afterOutsideRef)?.focus());
      }
    })]
  });
}
function I0(l, i = {}) {
  const {
    enabled: r = !0,
    event: s = "click",
    toggle: c = !0,
    ignoreMouse: f = !1,
    stickIfOpen: m = !0,
    touchOpenDelay: v = 0,
    reason: y = m0
  } = i, h = l.context.dataRef, p = b.useRef(void 0), g = Tu(), x = _a(), T = b.useMemo(() => {
    function A(E, M, R, I) {
      const C = it(y, M, R);
      E && I === "touch" && v > 0 ? x.start(v, () => {
        l.setOpen(!0, C);
      }) : l.setOpen(E, C);
    }
    function N(E, M, R) {
      const I = h.current.openEvent, C = l.select("domReferenceElement") !== M;
      return E && C || !E || !c ? !0 : I && (typeof m == "function" ? m() : m) ? !R(I.type) : !1;
    }
    return {
      onPointerDown(E) {
        p.current = Om(E.pointerType) && O0(E.nativeEvent) ? "virtual" : E.pointerType;
      },
      onMouseDown(E) {
        const M = p.current, R = E.nativeEvent, I = l.select("open");
        if (E.button !== 0 || s === "click" || Om(M) && f)
          return;
        const C = N(I, E.currentTarget, (U) => U === "click" || U === "mousedown"), z = cl(R), V = Lc(z);
        if (V || M === "virtual") {
          A(C, R, V ? z : E.currentTarget, M);
          return;
        }
        const _ = E.currentTarget;
        g.request(() => {
          A(C, R, _, M);
        });
      },
      onClick(E) {
        if (s === "mousedown-only")
          return;
        const M = p.current;
        if (s === "mousedown" && M) {
          p.current = void 0;
          return;
        }
        if (Om(M) && f)
          return;
        const R = l.select("open"), I = N(R, E.currentTarget, (C) => C === "click" || C === "mousedown" || C === "keydown" || C === "keyup");
        A(I, E.nativeEvent, E.currentTarget, M);
      },
      onKeyDown() {
        p.current = void 0;
      }
    };
  }, [h, s, f, y, l, m, c, g, x, v]);
  return b.useMemo(() => r ? {
    reference: T
  } : un, [r, T]);
}
function IT() {
  return !1;
}
function VT(l) {
  return {
    escapeKey: typeof l == "boolean" ? l : l?.escapeKey ?? !1,
    outsidePress: typeof l == "boolean" ? l : l?.outsidePress ?? !0
  };
}
function x2(l, i = {}) {
  const {
    enabled: r = !0,
    escapeKey: s = !0,
    outsidePress: c = !0,
    outsidePressEvent: f = "sloppy",
    referencePress: m = IT,
    bubbles: v,
    externalTree: y
  } = i, h = l.useState("open"), p = l.useState("floatingElement"), {
    dataRef: g,
    events: x
  } = l.context, T = Gc(y), A = Re(typeof c == "function" ? c : () => !1), N = typeof c == "function" ? A : c, E = N !== !1, M = Re(() => f), {
    escapeKey: R,
    outsidePress: I
  } = VT(v), C = b.useRef(!1), z = b.useRef(!1), V = b.useRef(!1), _ = b.useRef(!1), U = b.useRef(!1), j = b.useRef(""), H = b.useRef(null), q = _a(), $ = _a(), Z = _a(), G = Re(() => {
    $.clear(), g.current.insideReactTree = !1;
  }), le = Re((O) => {
    const B = g.current.floatingContext?.nodeId;
    return (T ? wu(T.nodesRef.current, B) : []).some((oe) => oe.context?.open && !oe.context.dataRef.current[O]);
  }), k = Re((O) => wm(O, l.select("floatingElement")) || wm(O, l.select("domReferenceElement"))), ie = Re((O) => {
    m() && l.setOpen(!1, it(m0, O.nativeEvent));
  }), P = Re((O) => {
    if (!h || !r || !s || O.key !== "Escape")
      return;
    const B = QR(O) ? O.nativeEvent : O;
    if (U.current || B.isComposing || !R && le("__escapeKeyBubbles"))
      return;
    const ce = it(h0, B);
    l.setOpen(!1, ce), ce.isCanceled || O.preventDefault(), !R && !ce.isPropagationAllowed && O.stopPropagation();
  }), J = Re(() => {
    g.current.insideReactTree = !0, $.start(0, G);
  }), te = Re((O) => {
    if (!h || !r || O.button !== 0)
      return;
    const B = cl(O.nativeEvent);
    et(l.select("floatingElement"), B) && (C.current || (C.current = !0, z.current = !1));
  }), De = Re((O) => {
    !h || !r || (O.defaultPrevented || O.nativeEvent.defaultPrevented) && C.current && (z.current = !0);
  });
  b.useEffect(() => {
    function O(B) {
      B.open || (_.current = !1);
    }
    return x.on("openchange", O), () => {
      x.off("openchange", O);
    };
  }, [x]), b.useEffect(() => G, [G]), b.useEffect(() => {
    if (!h || !r)
      return h || (_.current = !1, U.current = !1, j.current = "", H.current = null), G;
    g.current.__escapeKeyBubbles = R, g.current.__outsidePressBubbles = I;
    const O = new No(), B = Qt(p);
    function ce() {
      Z.clear(), U.current = !0;
    }
    function oe() {
      U.current = !0, Z.start(
        // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
        // Only apply to WebKit for the test to remain 0ms.
        _o ? 5 : 0,
        () => {
          U.current = !1;
        }
      );
    }
    function ye() {
      V.current = !0, O.start(0, () => {
        V.current = !1;
      });
    }
    function de() {
      C.current = !1, z.current = !1;
    }
    function Ae() {
      const ne = j.current, ae = ne === "pen" || !ne ? "mouse" : ne, He = M(), Ce = typeof He == "function" ? He() : He;
      return typeof Ce == "string" ? Ce : Ce[ae];
    }
    function pe(ne) {
      const ae = Ae();
      return ae === "intentional" && ne.type !== "click" || ae === "sloppy" && ne.type === "click";
    }
    function xe(ne) {
      const ae = g.current.floatingContext?.nodeId, He = T && wu(T.nodesRef.current, ae).some((Ce) => wm(ne, Ce.context?.elements.floating));
      return k(ne) || He;
    }
    function Ke(ne) {
      if (pe(ne)) {
        ne.type !== "click" && !k(ne) && (O.clear(), V.current = !1), G();
        return;
      }
      if (g.current.insideReactTree) {
        G();
        return;
      }
      const ae = cl(ne), He = `[${Eu("inert")}]`, Ce = kn(ae) ? ae.getRootNode() : null, Oe = Array.from((Mo(Ce) ? Ce : Qt(l.select("floatingElement"))).querySelectorAll(He)), St = l.context.triggerElements;
      if (ae && (St.hasElement(ae) || St.hasMatchingElement((At) => et(At, ae))))
        return;
      let Ct = kn(ae) ? ae : null;
      for (; Ct && !Yi(Ct); ) {
        const At = Ki(Ct);
        if (Yi(At) || !kn(At))
          break;
        Ct = At;
      }
      if (!(Oe.length && kn(ae) && !uT(ae) && // Clicked on a direct ancestor (e.g. FloatingOverlay).
      !et(ae, l.select("floatingElement")) && // If the target root element contains none of the markers, then the
      // element was injected after the floating element rendered.
      Oe.every((At) => !et(Ct, At)))) {
        if (kt(ae) && !("touches" in ne)) {
          const At = Yi(ae), ft = Ml(ae), Wn = /auto|scroll/, ql = At || Wn.test(ft.overflowX), yl = At || Wn.test(ft.overflowY), el = ql && ae.clientWidth > 0 && ae.scrollWidth > ae.clientWidth, Wl = yl && ae.clientHeight > 0 && ae.scrollHeight > ae.clientHeight, Zt = ft.direction === "rtl", tl = Wl && (Zt ? ne.offsetX <= ae.offsetWidth - ae.clientWidth : ne.offsetX > ae.clientWidth), Tn = el && ne.offsetY > ae.clientHeight;
          if (tl || Tn)
            return;
        }
        if (!xe(ne)) {
          if (Ae() === "intentional") {
            if (ne.detail !== 0 && !Ou(ne) && !_.current)
              return;
            if (V.current) {
              O.clear(), V.current = !1;
              return;
            }
          }
          typeof N == "function" && !N(ne) || le("__outsidePressBubbles") || (l.setOpen(!1, it(g0, ne)), G());
        }
      }
    }
    function Ue(ne) {
      Ae() !== "sloppy" || ne.pointerType === "touch" || !l.select("open") || !r || k(ne) || Ke(ne);
    }
    function Le(ne) {
      if (Ae() !== "sloppy" || !l.select("open") || !r || k(ne))
        return;
      const ae = ne.touches[0];
      ae && (H.current = {
        startTime: Date.now(),
        startX: ae.clientX,
        startY: ae.clientY,
        dismissOnTouchEnd: !1,
        dismissOnMouseDown: !0
      }, q.start(1e3, () => {
        H.current && (H.current.dismissOnTouchEnd = !1, H.current.dismissOnMouseDown = !1);
      }));
    }
    function Se(ne, ae) {
      const He = cl(ne);
      if (!He)
        return;
      const Ce = Yt(He, ne.type, () => {
        ae(ne), Ce();
      });
    }
    function be(ne) {
      j.current = "touch", Se(ne, Le);
    }
    function Ne(ne) {
      q.clear(), ne.type === "pointerdown" && (ne.button === 0 && (_.current = !0), j.current = ne.pointerType), !(ne.type === "mousedown" && H.current && !H.current.dismissOnMouseDown) && Se(ne, (ae) => {
        ae.type === "pointerdown" ? Ue(ae) : Ke(ae);
      });
    }
    function Ee(ne) {
      if (ne.type === "pointercancel" && (_.current = !1), !C.current)
        return;
      const ae = z.current;
      if (de(), Ae() === "intentional") {
        if (ne.type === "pointercancel") {
          ae && ye();
          return;
        }
        if (!xe(ne)) {
          if (ae) {
            ye();
            return;
          }
          typeof N == "function" && !N(ne) || (O.clear(), V.current = !0, G());
        }
      }
    }
    function Ye(ne) {
      if (Ae() !== "sloppy" || !H.current || k(ne))
        return;
      const ae = ne.touches[0];
      if (!ae)
        return;
      const He = Math.abs(ae.clientX - H.current.startX), Ce = Math.abs(ae.clientY - H.current.startY), Oe = Math.sqrt(He * He + Ce * Ce);
      Oe > 5 && (H.current.dismissOnTouchEnd = !0), Oe > 10 && (Ke(ne), q.clear(), H.current = null);
    }
    function re(ne) {
      Se(ne, Ye);
    }
    function Me(ne) {
      Ae() !== "sloppy" || !H.current || k(ne) || (H.current.dismissOnTouchEnd && Ke(ne), q.clear(), H.current = null);
    }
    function je(ne) {
      Se(ne, Me);
    }
    const Pe = yr(s && yr(Yt(B, "keydown", P), Yt(B, "compositionstart", ce), Yt(B, "compositionend", oe)), E && yr(Yt(B, "click", Ne, !0), Yt(B, "pointerdown", Ne, !0), Yt(B, "pointerup", Ee, !0), Yt(B, "pointercancel", Ee, !0), Yt(B, "mousedown", Ne, !0), Yt(B, "mouseup", Ee, !0), Yt(B, "touchstart", be, {
      capture: !0,
      passive: !0
    }), Yt(B, "touchmove", re, {
      capture: !0,
      passive: !0
    }), Yt(B, "touchend", je, {
      capture: !0,
      passive: !0
    })));
    return () => {
      Pe(), O.clear(), de(), V.current = !1;
    };
  }, [g, p, s, E, N, h, r, R, I, P, G, M, le, k, T, l, q, Z]);
  const ge = b.useMemo(() => ({
    onKeyDown: P,
    onPointerDown: ie,
    onClick: ie
  }), [P, ie]), ze = b.useMemo(() => ({
    onKeyDown: P,
    // `onMouseDown` may be blocked if `event.preventDefault()` is called in
    // `onPointerDown`, such as with <NumberField.ScrubArea>.
    // See https://github.com/mui/base-ui/pull/3379
    onPointerDown: De,
    onMouseDown: De,
    onClickCapture: J,
    onMouseDownCapture(O) {
      J(), te(O);
    },
    onPointerDownCapture(O) {
      J(), te(O);
    },
    onMouseUpCapture: J,
    onTouchEndCapture: J,
    onTouchMoveCapture: J
  }), [P, J, te, De]);
  return b.useMemo(() => r ? {
    reference: ge,
    floating: ze,
    trigger: ge
  } : {}, [r, ge, ze]);
}
function LT(l) {
  const {
    popupStore: i,
    treatPopupAsFloatingElement: r = !1,
    floatingRootContext: s,
    floatingId: c,
    nested: f,
    onOpenChange: m
  } = l, v = i.useState("open"), y = i.useState("activeTriggerElement"), h = i.useState(r ? "popupElement" : "positionerElement"), p = m;
  return i.useSyncedValue("floatingId", c), Te(() => {
    const g = {
      open: v,
      floatingId: c,
      referenceElement: y,
      floatingElement: h
    };
    kn(y) && (g.domReferenceElement = y), s.state.positionReference === s.state.referenceElement && (g.positionReference = y), s.update(g);
  }, [v, c, y, h, s]), s.context.onOpenChange = p, s.context.nested = f, s;
}
function S2(l) {
  const {
    open: i,
    ref: r,
    preventUnmountOnClose: s,
    setPreventUnmountOnClose: c,
    onUnmount: f,
    animateInitialOpen: m
  } = l, v = Re(c), {
    mounted: y,
    setMounted: h,
    transitionStatus: p
  } = Tr(i, !1, !1, m), g = i ? !1 : s;
  Te(() => {
    i && v(!1);
  }, [i, v]);
  const x = b.useRef(y), T = b.useRef(!1), A = By(), N = () => {
    x.current = !1, h(!1), f();
  };
  Te(() => {
    x.current = y, T.current && (T.current = !1, !i && y && N());
  });
  const E = Re(() => {
    if (x.current) {
      if (i) {
        T.current = !0, A();
        return;
      }
      N();
    }
  });
  return Zi({
    enabled: y && !i && !g,
    open: i,
    ref: r,
    onComplete() {
      i || E();
    }
  }), {
    mounted: y,
    transitionStatus: p,
    preventUnmountingOnClose: g,
    forceUnmount: E
  };
}
const E2 = {
  tabIndex: -1,
  [Pm]: ""
};
function BT(l) {
  return (i) => i === "touch" ? l.current : !0;
}
function qT(l, i = !1) {
  const r = Mc(), s = H0() != null, c = fl(() => l(r, s)).current;
  return LT({
    popupStore: c,
    treatPopupAsFloatingElement: i,
    floatingRootContext: c.state.floatingRootContext,
    floatingId: r,
    nested: s,
    onOpenChange: c.setOpen
  }), c;
}
function GT({
  handle: l,
  store: i
}) {
  return Te(() => l.attachStore(i), [l, i]), null;
}
function jb(l) {
  const i = l.context.triggerElements.size;
  l.select("open") && l.state.triggerCount !== i && l.set("triggerCount", i);
}
function YT(l, i) {
  const r = b.useRef(null);
  return Re((s) => {
    const c = r.current;
    if (c !== null) {
      if (c.element === s && c.store === i && c.id === l)
        return;
      r.current = null;
      const f = c.store;
      f.context.triggerElements.getById(c.id) === c.element && (f.context.triggerElements.delete(c.id), jb(f));
    }
    s !== null && l !== void 0 && (r.current = {
      store: i,
      id: l,
      element: s
    }, i.context.triggerElements.add(l, s), jb(i));
  });
}
function kT(l, i, r, s = !1) {
  let c = l.preventUnmountingOnClose;
  i ? c = !1 : s && (c = !0);
  const f = r?.id ?? null;
  let m = l.activeTriggerId, v = l.activeTriggerElement;
  return (f || i) && (m = f, v = r ?? null), {
    open: i,
    preventUnmountingOnClose: c,
    activeTriggerId: m,
    activeTriggerElement: v,
    // An open request without a trigger (a handle's `open(null)` or `openWithPayload()`) must not
    // be reassociated with a lone registered trigger later on. Controlled and default opens never
    // pass through here, so they keep claiming a lone trigger. A close request keeps the flag: a
    // controlled root may decline it and stay open, so the Root clears the flag only once the
    // popup is effectively closed.
    openedWithoutTrigger: i ? r == null : l.openedWithoutTrigger
  };
}
function XT(l) {
  let i = !1;
  return l.preventUnmountOnClose = () => {
    i = !0;
  }, () => i;
}
function KT(l, i, r, s) {
  const c = r.useState("isMountedByTrigger", l), f = YT(l, r), m = Re((y) => {
    const h = r.select("open"), p = r.select("activeTriggerId");
    if (p === l) {
      const g = {
        activeTriggerElement: y,
        ...h ? s : null
      };
      r.update(g);
      return;
    }
    if (p == null && h && !r.state.openedWithoutTrigger) {
      const g = {
        activeTriggerId: l ?? null,
        activeTriggerElement: y,
        ...s
      };
      r.update(g);
    }
  }), v = Re((y) => {
    f(y), y && m(y);
  });
  return Te(() => (v(i.current), () => v(null)), [v, i, r, l]), Te(() => {
    if (c) {
      const y = {
        activeTriggerElement: i.current,
        ...s
      };
      r.update(y);
    }
  }, [c, r, i, ...Object.values(s)]), {
    registerTrigger: v,
    isMountedByThisTrigger: c
  };
}
function PT(l, i = {}) {
  const {
    closeOnActiveTriggerUnmount: r = !1
  } = i, s = b.useRef(null), c = l.useState("open"), f = l.useState("triggerCount"), m = l.useState("activeTriggerId"), v = l.useState("activeTriggerElement");
  Te(() => {
    if (!c) {
      s.current = null, l.state.triggerCount !== 0 && l.set("triggerCount", 0), l.state.openedWithoutTrigger && l.set("openedWithoutTrigger", !1);
      return;
    }
    const y = l.context.triggerElements.size, h = {};
    l.state.triggerCount !== y && (h.triggerCount = y);
    const p = l.select("activeTriggerId");
    let g = null;
    if (p) {
      const x = l.context.triggerElements.getById(p);
      if (x)
        s.current = p, x !== l.state.activeTriggerElement && (h.activeTriggerElement = x);
      else {
        for (const [T, A] of l.context.triggerElements.entries())
          if (A === l.state.activeTriggerElement) {
            h.activeTriggerId = T, h.activeTriggerElement = A, s.current = T;
            break;
          }
        h.activeTriggerId === void 0 && (s.current === p ? g = p : s.current = null);
      }
    } else
      s.current = null;
    if (!g && !p && !l.state.openedWithoutTrigger && y === 1) {
      const x = l.context.triggerElements.entries().next();
      if (!x.done) {
        const [T, A] = x.value;
        h.activeTriggerId = T, h.activeTriggerElement = A, s.current = T;
      }
    }
    (h.triggerCount !== void 0 || h.activeTriggerId !== void 0 || h.activeTriggerElement !== void 0) && l.update(h), g && r && queueMicrotask(() => {
      if (l.select("open") && l.select("activeTriggerId") === g && !l.context.triggerElements.getById(g)) {
        const x = it(Yn);
        l.setOpen(!1, x), x.isCanceled || l.update({
          activeTriggerId: null,
          activeTriggerElement: null
        });
      }
    });
  }, [c, l, f, m, v, r]);
}
function QT(l, i, r, s) {
  const {
    mounted: c,
    transitionStatus: f,
    forceUnmount: m
  } = S2({
    open: l,
    ref: i.context.popupRef,
    preventUnmountOnClose: i.useState("preventUnmountingOnClose"),
    setPreventUnmountOnClose: (v) => i.set("preventUnmountingOnClose", v),
    animateInitialOpen: s,
    onUnmount() {
      i.update({
        activeTriggerId: null,
        activeTriggerElement: null,
        mounted: !1,
        preventUnmountingOnClose: !1
      }), i.context.onOpenChangeComplete?.(!1);
    }
  });
  return fl(() => (i.set("mounted", c), null)), i.useSyncedValues({
    mounted: c,
    transitionStatus: f
  }), {
    forceUnmount: m,
    transitionStatus: f
  };
}
function ZT(l, i) {
  l.useSyncedValues(i), Te(() => () => {
    l.update({
      activeTriggerProps: un,
      inactiveTriggerProps: un,
      popupProps: un
    });
  }, [l]);
}
function FT(l, i) {
  Te(() => {
    !i && l.state.openMethod !== null && l.set("openMethod", null);
  }, [i, l]), Te(() => () => {
    l.state.openMethod !== null && l.set("openMethod", null);
  }, [l]);
}
class C2 {
  idMap = /* @__PURE__ */ new Map();
  /**
   * Adds a trigger element with the given ID.
   *
   * Note: The provided element is assumed to not be registered under multiple IDs.
   */
  add(i, r) {
    this.idMap.set(i, r);
  }
  /**
   * Removes the trigger element with the given ID.
   */
  delete(i) {
    this.idMap.delete(i);
  }
  /**
   * Whether the given element is registered as a trigger.
   */
  hasElement(i) {
    for (const r of this.idMap.values())
      if (r === i)
        return !0;
    return !1;
  }
  /**
   * Whether there is a registered trigger element matching the given predicate.
   */
  hasMatchingElement(i) {
    for (const r of this.idMap.values())
      if (i(r))
        return !0;
    return !1;
  }
  /**
   * Returns the trigger element associated with the given ID, or undefined if no such element exists.
   */
  getById(i) {
    return this.idMap.get(i);
  }
  /**
   * Returns an iterable of all registered trigger entries, where each entry is a tuple of [id, element].
   */
  entries() {
    return this.idMap.entries();
  }
  /**
   * Returns an iterable of all registered trigger elements.
   */
  elements() {
    return this.idMap.values();
  }
  /**
   * Returns the number of registered trigger elements.
   */
  get size() {
    return this.idMap.size;
  }
}
var Dm = { exports: {} }, zm = {};
var Hb;
function JT() {
  if (Hb) return zm;
  Hb = 1;
  var l = Mu();
  function i(g, x) {
    return g === x && (g !== 0 || 1 / g === 1 / x) || g !== g && x !== x;
  }
  var r = typeof Object.is == "function" ? Object.is : i, s = l.useState, c = l.useEffect, f = l.useLayoutEffect, m = l.useDebugValue;
  function v(g, x) {
    var T = x(), A = s({ inst: { value: T, getSnapshot: x } }), N = A[0].inst, E = A[1];
    return f(
      function() {
        N.value = T, N.getSnapshot = x, y(N) && E({ inst: N });
      },
      [g, T, x]
    ), c(
      function() {
        return y(N) && E({ inst: N }), g(function() {
          y(N) && E({ inst: N });
        });
      },
      [g]
    ), m(T), T;
  }
  function y(g) {
    var x = g.getSnapshot;
    g = g.value;
    try {
      var T = x();
      return !r(g, T);
    } catch {
      return !0;
    }
  }
  function h(g, x) {
    return x();
  }
  var p = typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u" ? h : v;
  return zm.useSyncExternalStore = l.useSyncExternalStore !== void 0 ? l.useSyncExternalStore : p, zm;
}
var Ub;
function R2() {
  return Ub || (Ub = 1, Dm.exports = JT()), Dm.exports;
}
var V0 = R2(), _m = { exports: {} }, jm = {};
var Ib;
function $T() {
  if (Ib) return jm;
  Ib = 1;
  var l = Mu(), i = R2();
  function r(h, p) {
    return h === p && (h !== 0 || 1 / h === 1 / p) || h !== h && p !== p;
  }
  var s = typeof Object.is == "function" ? Object.is : r, c = i.useSyncExternalStore, f = l.useRef, m = l.useEffect, v = l.useMemo, y = l.useDebugValue;
  return jm.useSyncExternalStoreWithSelector = function(h, p, g, x, T) {
    var A = f(null);
    if (A.current === null) {
      var N = { hasValue: !1, value: null };
      A.current = N;
    } else N = A.current;
    A = v(
      function() {
        function M(V) {
          if (!R) {
            if (R = !0, I = V, V = x(V), T !== void 0 && N.hasValue) {
              var _ = N.value;
              if (T(_, V))
                return C = _;
            }
            return C = V;
          }
          if (_ = C, s(I, V)) return _;
          var U = x(V);
          return T !== void 0 && T(_, U) ? (I = V, _) : (I = V, C = U);
        }
        var R = !1, I, C, z = g === void 0 ? null : g;
        return [
          function() {
            return M(p());
          },
          z === null ? void 0 : function() {
            return M(z());
          }
        ];
      },
      [p, g, x, T]
    );
    var E = c(h, A[0], A[1]);
    return m(
      function() {
        N.hasValue = !0, N.value = E;
      },
      [E]
    ), y(E), E;
  }, jm;
}
var Vb;
function WT() {
  return Vb || (Vb = 1, _m.exports = $T()), _m.exports;
}
var eA = WT();
const Wm = [];
let e0;
function tA() {
  return e0;
}
function nA(l) {
  Wm.push(l);
}
function T2(l) {
  const i = (r, s) => {
    const c = fl(aA).current;
    let f;
    try {
      e0 = c;
      for (const m of Wm)
        m.before(c);
      f = l(r, s);
      for (const m of Wm)
        m.after(c);
      c.didInitialize = !0;
    } finally {
      e0 = void 0;
    }
    return f;
  };
  return i.displayName = l.displayName || l.name, i;
}
function lA(l) {
  return /* @__PURE__ */ b.forwardRef(T2(l));
}
function aA() {
  return {
    didInitialize: !1
  };
}
const iA = d0(19), oA = iA ? uA : sA;
function A2(l, i, r, s, c) {
  return oA(l, i, r, s, c);
}
function rA(l, i, r, s, c) {
  const f = b.useCallback(() => i(l.getSnapshot(), r, s, c), [l, i, r, s, c]);
  return V0.useSyncExternalStore(l.subscribe, f, f);
}
nA({
  before(l) {
    l.syncIndex = 0, l.didInitialize || (l.syncTick = 1, l.syncHooks = [], l.didChangeStore = !0, l.getSnapshot = () => {
      let i = !1;
      for (let r = 0; r < l.syncHooks.length; r += 1) {
        const s = l.syncHooks[r], c = s.selector(s.store.state, s.a1, s.a2, s.a3);
        Object.is(s.value, c) || (i = !0, s.value = c);
      }
      return i && (l.syncTick += 1), l.syncTick;
    });
  },
  after(l) {
    l.syncHooks.length > 0 && (l.didChangeStore && (l.didChangeStore = !1, l.subscribe = (i) => {
      const r = /* @__PURE__ */ new Set();
      for (const c of l.syncHooks)
        r.add(c.store);
      const s = [];
      for (const c of r)
        s.push(c.subscribe(i));
      return () => {
        for (const c of s)
          c();
      };
    }), V0.useSyncExternalStore(l.subscribe, l.getSnapshot, l.getSnapshot));
  }
});
function uA(l, i, r, s, c) {
  const f = tA();
  if (!f)
    return rA(l, i, r, s, c);
  const m = f.syncIndex;
  f.syncIndex += 1;
  let v;
  return f.didInitialize ? (v = f.syncHooks[m], (v.store !== l || v.selector !== i || !Object.is(v.a1, r) || !Object.is(v.a2, s) || !Object.is(v.a3, c)) && (v.store !== l && (f.didChangeStore = !0), v.store = l, v.selector = i, v.a1 = r, v.a2 = s, v.a3 = c, v.value = i(l.getSnapshot(), r, s, c))) : (v = {
    store: l,
    selector: i,
    a1: r,
    a2: s,
    a3: c,
    value: i(l.getSnapshot(), r, s, c)
  }, f.syncHooks.push(v)), v.value;
}
function sA(l, i, r, s, c) {
  return eA.useSyncExternalStoreWithSelector(l.subscribe, l.getSnapshot, l.getSnapshot, (f) => i(f, r, s, c));
}
class cA {
  /**
   * Creates a store with the given initial state, constructing the class it is called on.
   * Calling it on a generic base class (e.g. `ReactStore.create(...)`) constructs that
   * class but degrades the inferred instance type to `Store`; use `new` there instead.
   */
  static create(i) {
    return new this(i);
  }
  /**
   * The current state of the store.
   * This property is updated immediately when the state changes as a result of calling {@link setState}, {@link update}, or {@link set}.
   * To subscribe to state changes, use the {@link useState} method. The value returned by {@link useState} is updated after the component renders (similarly to React's useState).
   * The values can be used directly (to avoid subscribing to the store) in effects or event handlers.
   *
   * Do not modify properties in state directly. Instead, use the provided methods to ensure proper state management and listener notification.
   */
  // Internal state to handle recursive `setState()` calls
  constructor(i) {
    this.state = i, this.listeners = /* @__PURE__ */ new Set(), this.updateTick = 0;
  }
  /**
   * Registers a listener that will be called whenever the store's state changes.
   *
   * @param fn The listener function to be called on state changes.
   * @returns A function to unsubscribe the listener.
   */
  subscribe = (i) => (this.listeners.add(i), () => {
    this.listeners.delete(i);
  });
  /**
   * Returns the current state of the store.
   */
  getSnapshot = () => this.state;
  /**
   * Updates the entire store's state and notifies all registered listeners.
   *
   * @param newState The new state to set for the store.
   */
  setState(i) {
    if (this.state === i)
      return;
    this.state = i, this.updateTick += 1;
    const r = this.updateTick;
    for (const s of this.listeners) {
      if (r !== this.updateTick)
        return;
      s(i);
    }
  }
  /**
   * Merges the provided changes into the current state and notifies listeners if there are changes.
   * Each value must match its state key. Pass an exact known subset rather than a broad
   * `Partial<State>`, which may contain `undefined` for required state fields.
   *
   * @param changes An object containing the changes to apply to the current state.
   */
  update(i) {
    for (const r in i)
      if (!Object.is(this.state[r], i[r])) {
        this.setState({
          ...this.state,
          ...i
        });
        return;
      }
  }
  /**
   * Sets a specific key in the store's state to a new value and notifies listeners if the value has changed.
   *
   * @param key The key in the store's state to update.
   * @param value The new value to set for the specified key.
   */
  set(i, r) {
    Object.is(this.state[i], r) || this.setState({
      ...this.state,
      [i]: r
    });
  }
  /**
   * Gives the state a new reference and updates all registered listeners.
   */
  notifyAll() {
    const i = {
      ...this.state
    };
    this.setState(i);
  }
  use(i, r, s, c) {
    return A2(this, i, r, s, c);
  }
}
class L0 extends cA {
  /**
   * Creates a new ReactStore instance.
   *
   * @param state Initial state of the store.
   * @param context Non-reactive context values.
   * @param selectors Optional selectors for use with `useState`.
   */
  constructor(i, r = {}, s) {
    super(i), this.context = r, this.selectors = s;
  }
  /**
   * Non-reactive values such as refs, callbacks, etc.
   */
  /**
   * Synchronizes a single external value into the store.
   *
   * Note that the while the value in `state` is updated immediately, the value returned
   * by `useState` is updated before the next render (similarly to React's `useState`).
   */
  useSyncedValue(i, r) {
    b.useDebugValue(i);
    const s = this;
    Te(() => {
      s.state[i] !== r && s.set(i, r);
    }, [s, i, r]);
  }
  /**
   * Synchronizes a single external value into the store and
   * cleans it up (sets to `undefined`) on unmount.
   *
   * Note that the while the value in `state` is updated immediately, the value returned
   * by `useState` is updated before the next render (similarly to React's `useState`).
   */
  useSyncedValueWithCleanup(i, r) {
    const s = this;
    Te(() => (s.state[i] !== r && s.set(i, r), () => {
      s.set(i, void 0);
    }), [s, i, r]);
  }
  /**
   * Synchronizes multiple external values into the store.
   * Each value must match its state key. Pass an exact known subset rather than a broad
   * `Partial<State>`, which may contain `undefined` for required state fields.
   *
   * Note that the while the values in `state` are updated immediately, the values returned
   * by `useState` are updated before the next render (similarly to React's `useState`).
   *
   * @param statePart An exact subset of state fields to synchronize. Unknown keys are not accepted.
   */
  useSyncedValues(i) {
    const r = this, s = Object.values(i);
    Te(() => {
      r.update(i);
    }, [r, ...s]);
  }
  /**
   * Registers a controllable prop pair (`controlled`, `defaultValue`) for a specific key. If `controlled`
   * is non-undefined, the store's state at `key` is updated to match `controlled`.
   */
  useControlledProp(i, r) {
    b.useDebugValue(i);
    const s = this, c = r !== void 0;
    Te(() => {
      c && !Object.is(s.state[i], r) && s.setState({
        ...s.state,
        [i]: r
      });
    }, [s, i, r, c]);
  }
  /** Gets the current value from the store using a selector with the provided key.
   *
   * @param key Key of the selector to use.
   */
  select(i, r, s, c) {
    const f = this.selectors[i];
    return f(this.state, r, s, c);
  }
  /**
   * Returns a value from the store's state using a selector function.
   * Used to subscribe to specific parts of the state.
   * This methods causes a rerender whenever the selected state changes.
   *
   * @param key Key of the selector to use.
   */
  useState(i, r, s, c) {
    return b.useDebugValue(i), A2(this, this.selectors[i], r, s, c);
  }
  /**
   * Wraps a function with `useStableCallback` to ensure it has a stable reference
   * and assigns it to the context.
   *
   * @param key Key of the event callback. Must be a function in the context.
   * @param fn Function to assign.
   */
  useContextCallback(i, r) {
    b.useDebugValue(i);
    const s = Re(r ?? zt);
    this.context[i] = s;
  }
  /**
   * Returns a stable setter function for a specific key in the store's state.
   * It's commonly used to pass as a ref callback to React elements.
   *
   * @param key Key of the state to set.
   */
  useStateSetter(i) {
    const r = b.useRef(void 0);
    return r.current === void 0 && (r.current = (s) => {
      this.set(i, s);
    }), r.current;
  }
  /**
   * Observes changes derived from the store's selectors and calls the listener when the selected value changes.
   *
   * @param key Key of the selector to observe.
   * @param listener Listener function called when the selector result changes.
   */
  observe(i, r) {
    let s;
    typeof i == "function" ? s = i : s = this.selectors[i];
    let c = s(this.state);
    return r(c, c, this), this.subscribe((f) => {
      const m = s(f);
      if (!Object.is(c, m)) {
        const v = c;
        c = m, r(m, v, this);
      }
    });
  }
}
const fA = {
  open: (l) => l.open,
  transitionStatus: (l) => l.transitionStatus,
  domReferenceElement: (l) => l.domReferenceElement,
  referenceElement: (l) => l.positionReference ?? l.referenceElement,
  floatingElement: (l) => l.floatingElement,
  floatingId: (l) => l.floatingId
};
class O2 extends L0 {
  constructor(i) {
    const {
      syncOnly: r,
      nested: s,
      onOpenChange: c,
      triggerElements: f,
      ...m
    } = i;
    super({
      ...m,
      positionReference: m.referenceElement,
      domReferenceElement: m.referenceElement
    }, {
      onOpenChange: c,
      dataRef: {
        current: {}
      },
      events: zT(),
      nested: s,
      triggerElements: f
    }, fA), this.syncOnly = r;
  }
  /**
   * Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
   */
  syncOpenEvent = (i, r) => {
    (!i || !this.state.open || // Prevent a pending hover-open from overwriting a click-open event, while allowing
    // click events to upgrade a hover-open.
    r != null && ZR(r)) && (this.context.dataRef.current.openEvent = i ? r : void 0);
  };
  /**
   * Runs the root-owned side effects for an open state change.
   */
  dispatchOpenChange = (i, r) => {
    this.syncOpenEvent(i, r.event);
    const s = {
      open: i,
      reason: r.reason,
      nativeEvent: r.event,
      nested: this.context.nested,
      triggerElement: r.trigger
    };
    this.context.events.emit("openchange", s);
  };
  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  setOpen = (i, r) => {
    if (this.syncOnly) {
      this.context.onOpenChange?.(i, r);
      return;
    }
    this.dispatchOpenChange(i, r), this.context.onOpenChange?.(i, r);
  };
}
function dA(l, i, r = !1) {
  return {
    open: !1,
    openProp: void 0,
    mounted: !1,
    transitionStatus: void 0,
    floatingRootContext: new O2({
      open: !1,
      transitionStatus: void 0,
      floatingElement: null,
      referenceElement: null,
      triggerElements: l,
      floatingId: i,
      syncOnly: !0,
      nested: r,
      onOpenChange: void 0
    }),
    floatingId: i,
    triggerCount: 0,
    preventUnmountingOnClose: !1,
    payload: void 0,
    activeTriggerId: null,
    activeTriggerElement: null,
    openedWithoutTrigger: !1,
    triggerIdProp: void 0,
    popupElement: null,
    positionerElement: null,
    activeTriggerProps: un,
    inactiveTriggerProps: un,
    popupProps: un
  };
}
const Cu = (l) => l.triggerIdProp ?? l.activeTriggerId, xc = (l) => l.openProp ?? l.open, Lb = (l) => (l.popupElement?.id ?? l.floatingId) || void 0;
function w2(l, i) {
  return i !== void 0 && xc(l) && Cu(l) === i;
}
function mA(l, i) {
  return w2(l, i) ? !0 : i !== void 0 && xc(l) && Cu(l) == null && !l.openedWithoutTrigger && l.triggerCount === 1;
}
const gA = {
  open: xc,
  mounted: (l) => l.mounted,
  // `open` is written synchronously on an open change; `mounted`/`transitionStatus` sync in a
  // layout effect. Match useTransitionStatus so a retained popup does not miss its starting phase.
  transitionStatus: (l) => xc(l) && !l.mounted ? "starting" : l.transitionStatus,
  floatingRootContext: (l) => l.floatingRootContext,
  triggerCount: (l) => l.triggerCount,
  preventUnmountingOnClose: (l) => l.preventUnmountingOnClose,
  payload: (l) => l.payload,
  activeTriggerId: Cu,
  activeTriggerElement: (l) => l.mounted ? l.activeTriggerElement : null,
  popupId: Lb,
  /**
   * Whether the trigger with the given ID was used to open the popup.
   */
  isTriggerActive: (l, i) => i !== void 0 && Cu(l) === i,
  /**
   * Whether the popup is open and was activated by a trigger with the given ID.
   */
  isOpenedByTrigger: (l, i) => w2(l, i),
  /**
   * Whether the popup is mounted and was activated by a trigger with the given ID.
   */
  isMountedByTrigger: (l, i) => i !== void 0 && Cu(l) === i && l.mounted,
  triggerProps: (l, i) => i ? l.activeTriggerProps : l.inactiveTriggerProps,
  /**
   * Popup id for the trigger that currently owns the open popup.
   */
  triggerPopupId: (l, i) => mA(l, i) ? Lb(l) : void 0,
  popupProps: (l) => l.popupProps,
  popupElement: (l) => l.popupElement,
  positionerElement: (l) => l.positionerElement
};
function hA(l) {
  const i = b.useCallback((s) => l === void 0 ? zt : l.subscribeStore(s), [l]), r = b.useCallback(() => l === void 0 ? void 0 : l.store, [l]);
  return V0.useSyncExternalStore(i, r, () => l?.serverStore);
}
function pA(l) {
  const {
    open: i = !1,
    onOpenChange: r,
    elements: s = {}
  } = l, c = Mc(), f = H0() != null, m = fl(() => new O2({
    open: i,
    transitionStatus: void 0,
    onOpenChange: r,
    referenceElement: s.reference ?? null,
    floatingElement: s.floating ?? null,
    triggerElements: new C2(),
    floatingId: c,
    syncOnly: !1,
    nested: f
  })).current;
  return Te(() => {
    const v = {
      open: i,
      floatingId: c
    };
    s.reference !== void 0 && (v.referenceElement = s.reference, v.domReferenceElement = kn(s.reference) ? s.reference : null), s.floating !== void 0 && (v.floatingElement = s.floating), m.update(v);
  }, [i, c, s.reference, s.floating, m]), m.context.onOpenChange = r, m.context.nested = f, m;
}
function Bb(l) {
  return _o && l.movementX === 0 && l.movementY === 0;
}
function Yc(l, i, r) {
  switch (l) {
    case "vertical":
      return i;
    case "horizontal":
      return r;
    default:
      return i || r;
  }
}
function tc(l, i) {
  return Yc(i, l === w0 || l === Ic, l === Oo || l === wo);
}
function Hm(l, i, r) {
  return Yc(i, l === Ic, r ? l === Oo : l === wo) || l === "Enter" || l === " " || l === "";
}
function vA(l, i, r) {
  return Yc(i, r ? l === Oo : l === wo, l === Ic);
}
function bA(l, i, r, s) {
  const c = r ? l === wo : l === Oo, f = l === w0;
  return i === "both" || i === "horizontal" && s ? l === "Escape" : Yc(i, c, f);
}
function yA(l, i) {
  const {
    listRef: r,
    activeIndex: s,
    onNavigate: c = () => {
    },
    enabled: f = !0,
    selectedIndex: m = null,
    allowEscape: v = !1,
    loopFocus: y = !1,
    nested: h = !1,
    rtl: p = !1,
    virtual: g = !1,
    focusItemOnOpen: x = "auto",
    focusItemOnHover: T = !0,
    openOnArrowKeyDown: A = !0,
    disabledIndices: N = void 0,
    orientation: E = "vertical",
    triggerOrientation: M = E,
    parentOrientation: R,
    id: I,
    resetOnPointerLeave: C = !0,
    externalTree: z,
    nestedReturnFocusRef: V,
    grid: _
  } = i, U = _ != null, j = l.useState("open"), H = l.useState("floatingElement"), q = l.useState("domReferenceElement"), $ = l.context.dataRef, Z = Zm(H), G = Qm(q), le = sl(Z), k = H0(), ie = Gc(z), P = b.useRef(x), J = b.useRef(m ?? -1), te = b.useRef(null), De = b.useRef(!0), ge = Re((ne) => {
    c(J.current === -1 ? null : J.current, ne);
  }), ze = b.useRef(!!H), O = b.useRef(j), B = b.useRef(!1), ce = b.useRef(!1), oe = b.useRef(null), ye = sl(N), de = sl(j), Ae = sl(m), pe = sl(C), xe = Tu(), Ke = Tu(), Ue = Re(() => {
    xe.cancel();
    function ne(Oe) {
      g || (oe.current = rc(Oe, {
        sync: B.current,
        preventScroll: !0
      }));
    }
    const ae = r.current[J.current], He = ce.current;
    ae && ne(ae), (B.current ? (Oe) => Oe() : (Oe) => xe.request(Oe))(() => {
      const Oe = r.current[J.current] || ae;
      if (!Oe)
        return;
      ae || ne(Oe), // eslint-disable-next-line @typescript-eslint/no-use-before-define
      Ye && (He || !De.current) && Oe.scrollIntoView?.({
        block: "nearest",
        inline: "nearest"
      });
    });
  });
  Te(() => {
    $.current.orientation = E;
  }, [$, E]), Te(() => {
    j || (te.current = null), (!j || x !== "auto") && (P.current = x);
  }, [j, x]), Te(() => {
    f && (j && H ? (J.current = m ?? -1, P.current && m != null && (ce.current = !0, ge())) : ze.current && (J.current = -1, ge()));
  }, [f, j, H, m, ge]), Te(() => {
    if (f) {
      if (!j) {
        B.current = !1;
        return;
      }
      if (H)
        if (s == null) {
          if (B.current = !1, Ae.current != null)
            return;
          if (ze.current && (J.current = -1, Ue()), (!O.current || !ze.current) && P.current && (te.current != null || P.current === !0 && te.current == null)) {
            let ne = 0;
            const ae = () => {
              r.current[0] == null ? (ne < 2 && (ne ? (Ce) => Ke.request(Ce) : queueMicrotask)(ae), ne += 1) : (J.current = te.current == null || Hm(te.current, M, p) || h ? oc(r) : Jm(r), te.current = null, ge());
            };
            ae();
          }
        } else si(r.current, s) || (J.current = s, Ue(), ce.current = !1);
    }
  }, [f, j, H, s, Ae, h, r, M, p, ge, Ue, Ke]), Te(() => {
    if (!f || H || !ie || g || !ze.current)
      return;
    const ne = ie.nodesRef.current, ae = ne.find((Oe) => Oe.id === k)?.context?.elements.floating, He = Ol(Qt(q ?? ae ?? null)), Ce = ne.some((Oe) => Oe.context && et(Oe.context.elements.floating, He));
    ae && !Ce && De.current && ae.focus({
      preventScroll: !0
    });
  }, [f, H, q, ie, k, g]), Te(() => {
    O.current = j, ze.current = !!H;
  });
  const Le = s != null, Se = Re((ne) => {
    if (!de.current)
      return;
    const ae = r.current.indexOf(ne.currentTarget);
    ae !== -1 && (J.current !== ae || s !== ae) && (J.current = ae, ge(ne));
  }), be = Re(() => R ?? ie?.nodesRef.current.find((ne) => ne.id === k)?.context?.dataRef?.current.orientation), Ne = Re(() => oc(r, ye.current)), Ee = Re((ne) => {
    if (De.current = !1, B.current = !0, ne.which === 229 || !de.current && ne.currentTarget === le.current)
      return;
    if (h && bA(ne.key, E, p, U)) {
      tc(ne.key, be()) || zn(ne), l.setOpen(!1, it(Xm, ne.nativeEvent));
      const Oe = V?.current ?? q;
      kt(Oe) && Oe.focus();
      return;
    }
    s != null && s !== J.current && !si(r.current, s) && (J.current = s);
    const ae = J.current, He = oc(r, N), Ce = Jm(r, N);
    if (G || (ne.key === "Home" && (zn(ne), J.current = He, ge(ne)), ne.key === "End" && (zn(ne), J.current = Ce, ge(ne))), _ != null) {
      const Oe = _(ne, J.current, r, E, y, p, N, He, Ce);
      if (Oe != null && Oe !== J.current && (J.current = Oe, ge(ne)), E === "both")
        return;
    }
    if (tc(ne.key, E)) {
      zn(ne);
      const Oe = Ol(ne.currentTarget.ownerDocument);
      if (j && !g && et(ne.currentTarget, Oe) && !r.current.some((At) => At != null && et(At, Oe))) {
        J.current = Hm(ne.key, E, p) ? He : Ce, ge(ne), s === J.current && Ue();
        return;
      }
      const {
        index: St,
        wrapped: Ct
      } = vT(r.current, ae, {
        decrement: !Hm(ne.key, E, p),
        loopFocus: y,
        allowEscape: v,
        disabledIndices: N,
        minIndex: He,
        maxIndex: Ce
      });
      Ct && (B.current = !1), J.current = St, ge(ne);
    }
  }), Ye = b.useMemo(() => ({
    onFocus(ae) {
      B.current = !0, Se(ae);
    },
    onClick({
      currentTarget: ae
    }) {
      g || ae.focus({
        preventScroll: !0
      });
    },
    onMouseMove(ae) {
      Bb(ae) || (B.current = !0, ce.current = !1, T && Se(ae));
    },
    onPointerLeave(ae) {
      if (!de.current || !De.current || ae.pointerType === "touch")
        return;
      B.current = !0;
      const He = ae.relatedTarget;
      if (!(!T || r.current.includes(He)) && pe.current && (oe.current?.(), oe.current = null, J.current = -1, ge(ae), !g)) {
        const Ce = le.current, Oe = Ol(Qt(Ce));
        Ce && et(Ce, Oe) && Ce.focus({
          preventScroll: !0
        });
      }
    }
  }), [Se, de, le, T, r, ge, pe, g]), re = b.useMemo(() => g && j && Le && {
    "aria-activedescendant": `${I}-${s}`
  }, [g, j, Le, I, s]), Me = b.useMemo(() => ({
    ...G ? {} : re,
    onKeyDown(ne) {
      if (ne.key === "Tab" && ne.shiftKey && j && !g) {
        const ae = cl(ne.nativeEvent);
        if (ae && !et(le.current, ae))
          return;
        zn(ne);
        const He = it(Ru, ne.nativeEvent);
        l.setOpen(!1, He);
        const Ce = V?.current ?? q;
        !He.isCanceled && kt(Ce) && Ce.focus();
        return;
      }
      Ee(ne);
    },
    onPointerMove(ne) {
      Bb(ne) || (De.current = !0);
    }
  }), [re, Ee, le, G, l, j, g, q, V]), je = b.useMemo(() => {
    function ne(Ce) {
      l.setOpen(!0, it(Xm, Ce.nativeEvent, Ce.currentTarget));
    }
    function ae(Ce) {
      x === "auto" && Ou(Ce.nativeEvent) && (P.current = !g);
    }
    function He(Ce) {
      P.current = x, x === "auto" && O0(Ce.nativeEvent) && (P.current = !0);
    }
    return {
      onKeyDown(Ce) {
        const Oe = l.select("open");
        De.current = !1;
        const St = Ce.key.startsWith("Arrow"), Ct = vA(Ce.key, be(), p), At = tc(Ce.key, Oe ? E : M), ft = (h ? Ct : At) || Ce.key === "Enter" || Ce.key.trim() === "";
        if (g && Oe && (!h || Lc(Ce.currentTarget)))
          return Ee(Ce);
        if (!(!Oe && !A && St)) {
          if (ft) {
            const Wn = tc(Ce.key, be());
            te.current = h && Wn ? null : Ce.key;
          }
          if (h) {
            Ct && (zn(Ce), Oe ? (J.current = Ne(), ge(Ce), g && le.current?.focus()) : ne(Ce));
            return;
          }
          At && (Ae.current != null && (J.current = Ae.current), zn(Ce), !Oe && A ? ne(Ce) : Ee(Ce), Oe && ge(Ce));
        }
      },
      onFocus(Ce) {
        Ce.target === Ce.currentTarget && l.select("open") && !g && (J.current = -1, ge(Ce));
      },
      onPointerDown: He,
      onPointerEnter: He,
      onMouseDown: ae,
      onClick: ae
    };
  }, [Ee, x, Ne, h, ge, l, A, E, M, be, p, Ae, g, le]), Pe = b.useMemo(() => ({
    ...re,
    ...je
  }), [re, je]);
  return b.useMemo(() => f ? {
    reference: Pe,
    floating: Me,
    item: Ye,
    trigger: je
  } : {}, [f, Pe, Me, je, Ye]);
}
function xA(l, i) {
  const {
    listRef: r,
    elementsRef: s,
    activeIndex: c,
    onMatch: f,
    disabledIndices: m,
    onTyping: v,
    enabled: y = !0,
    resetMs: h = 750,
    selectedIndex: p = null
  } = i, g = Re(v), x = l.useState("open"), T = _a(), A = b.useRef(""), N = b.useRef(p ?? c ?? -1), E = b.useRef(null), M = Re((C) => {
    function z(G) {
      return s?.current[G];
    }
    function V(G) {
      const le = z(G);
      return le && !Bc(le) || le?.matches(":disabled") ? !1 : m == null || !ki(Vl, G, m);
    }
    function _(G, le, k = 0) {
      if (G.length === 0)
        return -1;
      const ie = (k % G.length + G.length) % G.length, P = le.toLowerCase();
      for (let J = 0; J < G.length; J += 1) {
        const te = (ie + J) % G.length;
        if (!(!G[te]?.toLowerCase().startsWith(P) || !V(te)))
          return te;
      }
      return -1;
    }
    const U = r.current;
    if (A.current.length > 0 && C.key === " " && (zn(C), g?.(!0)), A.current.length > 0 && A.current[0] !== " " && _(U, A.current) === -1 && C.key !== " " && g?.(!1), U == null || // Character key.
    C.key.length !== 1 || // Modifier key.
    C.ctrlKey || C.metaKey || C.altKey)
      return;
    x && C.key !== " " && (zn(C), g?.(!0));
    const j = A.current === "";
    j && (N.current = p ?? c ?? -1), U.every((G, le) => G && V(le) ? G[0]?.toLowerCase() !== G[1]?.toLowerCase() : !0) && A.current === C.key && (A.current = "", N.current = E.current), A.current += C.key, T.start(h, () => {
      A.current = "", N.current = E.current, g?.(!1);
    });
    const $ = ((j ? p ?? c ?? -1 : N.current) ?? 0) + 1, Z = _(U, A.current, $);
    Z !== -1 ? (f?.(Z, C), E.current = Z) : C.key !== " " && (A.current = "", g?.(!1));
  }), R = Re((C) => {
    const z = C.relatedTarget, V = l.select("domReferenceElement"), _ = l.select("floatingElement");
    et(V, z) || et(_, z) || (T.clear(), A.current = "", N.current = E.current, g?.(!1));
  });
  Te(() => {
    !x && p !== null || (T.clear(), E.current = null, A.current !== "" && (A.current = "", g?.(!1)));
  }, [x, p, T, g]);
  const I = b.useMemo(() => ({
    onKeyDown: M,
    onBlur: R
  }), [M, R]);
  return b.useMemo(() => y ? {
    reference: I,
    floating: I
  } : {}, [y, I]);
}
function qb(l, i, r) {
  let {
    reference: s,
    floating: c
  } = l;
  const f = $l(i), m = _0(i), v = z0(m), y = Ll(i), h = f === "y", p = s.x + s.width / 2 - c.width / 2, g = s.y + s.height / 2 - c.height / 2, x = s[v] / 2 - c[v] / 2;
  let T;
  switch (y) {
    case "top":
      T = {
        x: p,
        y: s.y - c.height
      };
      break;
    case "bottom":
      T = {
        x: p,
        y: s.y + s.height
      };
      break;
    case "right":
      T = {
        x: s.x + s.width,
        y: g
      };
      break;
    case "left":
      T = {
        x: s.x - c.width,
        y: g
      };
      break;
    default:
      T = {
        x: s.x,
        y: s.y
      };
  }
  const A = ja(i);
  return A && (T[m] += x * (A === "end" ? 1 : -1) * (r && h ? -1 : 1)), T;
}
async function SA(l, i) {
  var r;
  i === void 0 && (i = {});
  const {
    x: s,
    y: c,
    platform: f,
    rects: m,
    elements: v,
    strategy: y
  } = l, {
    boundary: h = "clippingAncestors",
    rootBoundary: p = "viewport",
    elementContext: g = "floating",
    altBoundary: x = !1,
    padding: T = 0
  } = Pi(i, l), A = l2(T), E = v[x ? g === "floating" ? "reference" : "floating" : g], M = yc(await f.getClippingRect({
    element: (r = await (f.isElement == null ? void 0 : f.isElement(E))) == null || r ? E : E.contextElement || await (f.getDocumentElement == null ? void 0 : f.getDocumentElement(v.floating)),
    boundary: h,
    rootBoundary: p,
    strategy: y
  })), R = g === "floating" ? {
    x: s,
    y: c,
    width: m.floating.width,
    height: m.floating.height
  } : m.reference, I = await (f.getOffsetParent == null ? void 0 : f.getOffsetParent(v.floating)), C = await (f.isElement == null ? void 0 : f.isElement(I)) && await (f.getScale == null ? void 0 : f.getScale(I)) || {
    x: 1,
    y: 1
  }, z = yc(f.convertOffsetParentRelativeRectToViewportRelativeRect ? await f.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements: v,
    rect: R,
    offsetParent: I,
    strategy: y
  }) : R);
  return {
    top: (M.top - z.top + A.top) / C.y,
    bottom: (z.bottom - M.bottom + A.bottom) / C.y,
    left: (M.left - z.left + A.left) / C.x,
    right: (z.right - M.right + A.right) / C.x
  };
}
const EA = 50, CA = async (l, i, r) => {
  const {
    placement: s = "bottom",
    strategy: c = "absolute",
    middleware: f = [],
    platform: m
  } = r, v = m.detectOverflow ? m : {
    ...m,
    detectOverflow: SA
  }, y = await (m.isRTL == null ? void 0 : m.isRTL(i));
  let h = await m.getElementRects({
    reference: l,
    floating: i,
    strategy: c
  }), {
    x: p,
    y: g
  } = qb(h, s, y), x = s, T = 0;
  const A = {};
  for (let N = 0; N < f.length; N++) {
    const E = f[N];
    if (!E)
      continue;
    const {
      name: M,
      fn: R
    } = E, {
      x: I,
      y: C,
      data: z,
      reset: V
    } = await R({
      x: p,
      y: g,
      initialPlacement: s,
      placement: x,
      strategy: c,
      middlewareData: A,
      rects: h,
      platform: v,
      elements: {
        reference: l,
        floating: i
      }
    });
    p = I ?? p, g = C ?? g, A[M] = {
      ...A[M],
      ...z
    }, V && T < EA && (T++, typeof V == "object" && (V.placement && (x = V.placement), V.rects && (h = V.rects === !0 ? await m.getElementRects({
      reference: l,
      floating: i,
      strategy: c
    }) : V.rects), {
      x: p,
      y: g
    } = qb(h, x, y)), N = -1);
  }
  return {
    x: p,
    y: g,
    placement: x,
    strategy: c,
    middlewareData: A
  };
}, RA = function(l) {
  return l === void 0 && (l = {}), {
    name: "flip",
    options: l,
    async fn(i) {
      var r, s;
      const {
        placement: c,
        middlewareData: f,
        rects: m,
        initialPlacement: v,
        platform: y,
        elements: h
      } = i, {
        mainAxis: p = !0,
        crossAxis: g = !0,
        fallbackPlacements: x,
        fallbackStrategy: T = "bestFit",
        fallbackAxisSideDirection: A = "none",
        flipAlignment: N = !0,
        ...E
      } = Pi(l, i);
      if ((r = f.arrow) != null && r.alignmentOffset)
        return {};
      const M = Ll(c), R = $l(v), I = Ll(v) === v, C = await (y.isRTL == null ? void 0 : y.isRTL(h.floating)), z = x || (I || !N ? [bc(v)] : fT(v)), V = A !== "none";
      !x && V && z.push(...hT(v, N, A, C));
      const _ = [v, ...z], U = await y.detectOverflow(i, E), j = [];
      let H = ((s = f.flip) == null ? void 0 : s.overflows) || [];
      if (p && j.push(U[M]), g) {
        const G = cT(c, m, C);
        j.push(U[G[0]], U[G[1]]);
      }
      if (H = [...H, {
        placement: c,
        overflows: j
      }], !j.every((G) => G <= 0)) {
        var q, $;
        const G = (((q = f.flip) == null ? void 0 : q.index) || 0) + 1, le = _[G];
        if (le && (!(g === "alignment" ? R !== $l(le) : !1) || // We leave the current main axis only if every placement on that axis
        // overflows the main axis.
        H.every((P) => $l(P.placement) === R ? P.overflows[0] > 0 : !0)))
          return {
            data: {
              index: G,
              overflows: H
            },
            reset: {
              placement: le
            }
          };
        let k = ($ = H.filter((ie) => ie.overflows[0] <= 0).sort((ie, P) => ie.overflows[1] - P.overflows[1])[0]) == null ? void 0 : $.placement;
        if (!k)
          switch (T) {
            case "bestFit": {
              var Z;
              const ie = (Z = H.filter((P) => {
                if (V) {
                  const J = $l(P.placement);
                  return J === R || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  J === "y";
                }
                return !0;
              }).map((P) => [P.placement, P.overflows.filter((J) => J > 0).reduce((J, te) => J + te, 0)]).sort((P, J) => P[1] - J[1])[0]) == null ? void 0 : Z[0];
              ie && (k = ie);
              break;
            }
            case "initialPlacement":
              k = v;
              break;
          }
        if (c !== k)
          return {
            reset: {
              placement: k
            }
          };
      }
      return {};
    }
  };
}, M2 = /* @__PURE__ */ new Set(["left", "top"]);
async function TA(l, i) {
  const {
    placement: r,
    platform: s,
    elements: c
  } = l, f = await (s.isRTL == null ? void 0 : s.isRTL(c.floating)), m = Ll(r), v = ja(r), y = $l(r) === "y", h = M2.has(m) ? -1 : 1, p = f && y ? -1 : 1, g = Pi(i, l);
  let {
    mainAxis: x,
    crossAxis: T,
    alignmentAxis: A
  } = typeof g == "number" ? {
    mainAxis: g,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: g.mainAxis || 0,
    crossAxis: g.crossAxis || 0,
    alignmentAxis: g.alignmentAxis
  };
  return v && typeof A == "number" && (T = v === "end" ? A * -1 : A), y ? {
    x: T * p,
    y: x * h
  } : {
    x: x * h,
    y: T * p
  };
}
const AA = function(l) {
  return l === void 0 && (l = 0), {
    name: "offset",
    options: l,
    async fn(i) {
      var r, s;
      const {
        x: c,
        y: f,
        placement: m,
        middlewareData: v
      } = i, y = await TA(i, l);
      return m === ((r = v.offset) == null ? void 0 : r.placement) && (s = v.arrow) != null && s.alignmentOffset ? {} : {
        x: c + y.x,
        y: f + y.y,
        data: {
          ...y,
          placement: m
        }
      };
    }
  };
}, OA = function(l) {
  return l === void 0 && (l = {}), {
    name: "shift",
    options: l,
    async fn(i) {
      const {
        x: r,
        y: s,
        placement: c,
        platform: f
      } = i, {
        mainAxis: m = !0,
        crossAxis: v = !1,
        limiter: y = {
          fn: (R) => {
            let {
              x: I,
              y: C
            } = R;
            return {
              x: I,
              y: C
            };
          }
        },
        ...h
      } = Pi(l, i), p = {
        x: r,
        y: s
      }, g = await f.detectOverflow(i, h), x = $l(c), T = D0(x);
      let A = p[T], N = p[x];
      const E = (R, I) => n2(I + g[R === "y" ? "top" : "left"], I, I - g[R === "y" ? "bottom" : "right"]);
      m && (A = E(T, A)), v && (N = E(x, N));
      const M = y.fn({
        ...i,
        [T]: A,
        [x]: N
      });
      return {
        ...M,
        data: {
          x: M.x - r,
          y: M.y - s,
          enabled: {
            [T]: m,
            [x]: v
          }
        }
      };
    }
  };
}, wA = function(l) {
  return l === void 0 && (l = {}), {
    options: l,
    fn(i) {
      var r, s;
      const {
        x: c,
        y: f,
        placement: m,
        rects: v,
        middlewareData: y
      } = i, {
        offset: h = 0,
        mainAxis: p = !0,
        crossAxis: g = !0
      } = Pi(l, i), x = {
        x: c,
        y: f
      }, T = $l(m), A = D0(T);
      let N = x[A], E = x[T];
      const M = Pi(h, i), R = typeof M == "number" ? {
        mainAxis: M,
        crossAxis: 0
      } : {
        mainAxis: (r = M.mainAxis) != null ? r : 0,
        crossAxis: (s = M.crossAxis) != null ? s : 0
      };
      if (p) {
        const z = A === "y" ? "height" : "width", V = v.reference[A] - v.floating[z] + R.mainAxis, _ = v.reference[A] + v.reference[z] - R.mainAxis;
        N < V ? N = V : N > _ && (N = _);
      }
      if (g) {
        var I, C;
        const z = A === "y" ? "width" : "height", V = M2.has(Ll(m)), _ = v.reference[T] - v.floating[z] + (V && ((I = y.offset) == null ? void 0 : I[T]) || 0) + (V ? 0 : R.crossAxis), U = v.reference[T] + v.reference[z] + (V ? 0 : ((C = y.offset) == null ? void 0 : C[T]) || 0) - (V ? R.crossAxis : 0);
        E < _ ? E = _ : E > U && (E = U);
      }
      return {
        [A]: N,
        [T]: E
      };
    }
  };
}, MA = function(l) {
  return l === void 0 && (l = {}), {
    name: "size",
    options: l,
    async fn(i) {
      const {
        placement: r,
        rects: s,
        platform: c,
        elements: f
      } = i, {
        apply: m = () => {
        },
        ...v
      } = Pi(l, i), y = await c.detectOverflow(i, v), h = Ll(r), p = ja(r), g = $l(r) === "y", {
        width: x,
        height: T
      } = s.floating;
      let A, N;
      h === "top" || h === "bottom" ? (A = h, N = p === (await (c.isRTL == null ? void 0 : c.isRTL(f.floating)) ? "start" : "end") ? "left" : "right") : (N = h, A = p === "end" ? "top" : "bottom");
      const E = T - y.top - y.bottom, M = x - y.left - y.right, R = Rr(T - y[A], E), I = Rr(x - y[N], M), C = i.middlewareData.shift, z = !C;
      let V = R, _ = I;
      C != null && C.enabled.x && (_ = M), C != null && C.enabled.y && (V = E), z && !p && (g ? _ = x - 2 * ri(y.left, y.right) : V = T - 2 * ri(y.top, y.bottom)), await m({
        ...i,
        availableWidth: _,
        availableHeight: V
      });
      const U = await c.getDimensions(f.floating);
      return x !== U.width || T !== U.height ? {
        reset: {
          rects: !0
        }
      } : {};
    }
  };
};
function N2(l) {
  const i = Ml(l);
  let r = parseFloat(i.width) || 0, s = parseFloat(i.height) || 0;
  const c = kt(l), f = c ? l.offsetWidth : r, m = c ? l.offsetHeight : s, v = vc(r) !== f || vc(s) !== m;
  return v && (r = f, s = m), {
    width: r,
    height: s,
    $: v
  };
}
function B0(l) {
  return kn(l) ? l : l.contextElement;
}
function xr(l) {
  const i = B0(l);
  if (!kt(i))
    return ui(1);
  const r = i.getBoundingClientRect(), {
    width: s,
    height: c,
    $: f
  } = N2(i);
  let m = (f ? vc(r.width) : r.width) / s, v = (f ? vc(r.height) : r.height) / c;
  return (!m || !Number.isFinite(m)) && (m = 1), (!v || !Number.isFinite(v)) && (v = 1), {
    x: m,
    y: v
  };
}
const NA = /* @__PURE__ */ ui(0);
function D2(l) {
  const i = mn(l);
  return !x0() || !i.visualViewport ? NA : {
    x: i.visualViewport.offsetLeft,
    y: i.visualViewport.offsetTop
  };
}
function DA(l, i, r) {
  return i === void 0 && (i = !1), !!r && i && r === mn(l);
}
function Do(l, i, r, s) {
  i === void 0 && (i = !1), r === void 0 && (r = !1);
  const c = l.getBoundingClientRect(), f = B0(l);
  let m = ui(1);
  i && (s ? kn(s) && (m = xr(s)) : m = xr(l));
  const v = DA(f, r, s) ? D2(f) : ui(0);
  let y = (c.left + v.x) / m.x, h = (c.top + v.y) / m.y, p = c.width / m.x, g = c.height / m.y;
  if (f && s) {
    const x = mn(f), T = kn(s) ? mn(s) : s;
    let A = x, N = Km(A);
    for (; N && T !== A; ) {
      const E = xr(N), M = N.getBoundingClientRect(), R = Ml(N), I = M.left + (N.clientLeft + parseFloat(R.paddingLeft)) * E.x, C = M.top + (N.clientTop + parseFloat(R.paddingTop)) * E.y;
      y *= E.x, h *= E.y, p *= E.x, g *= E.y, y += I, h += C, A = mn(N), N = Km(A);
    }
  }
  return yc({
    width: p,
    height: g,
    x: y,
    y: h
  });
}
function kc(l, i) {
  const r = jc(l).scrollLeft;
  return i ? i.left + r : Do(di(l)).left + r;
}
function z2(l, i) {
  const r = l.getBoundingClientRect(), s = r.left + i.scrollLeft - kc(l, r), c = r.top + i.scrollTop;
  return {
    x: s,
    y: c
  };
}
function zA(l) {
  let {
    elements: i,
    rect: r,
    offsetParent: s,
    strategy: c
  } = l;
  const f = c === "fixed", m = di(s), v = i ? _c(i.floating) : !1;
  if (s === m || v && f)
    return r;
  let y = {
    scrollLeft: 0,
    scrollTop: 0
  }, h = ui(1);
  const p = ui(0), g = kt(s);
  if ((g || !f) && (($n(s) !== "body" || Nu(m)) && (y = jc(s)), g)) {
    const T = Do(s);
    h = xr(s), p.x = T.x + s.clientLeft, p.y = T.y + s.clientTop;
  }
  const x = m && !g && !f ? z2(m, y) : ui(0);
  return {
    width: r.width * h.x,
    height: r.height * h.y,
    x: r.x * h.x - y.scrollLeft * h.x + p.x + x.x,
    y: r.y * h.y - y.scrollTop * h.y + p.y + x.y
  };
}
function _A(l) {
  return l.getClientRects ? Array.from(l.getClientRects()) : [];
}
function jA(l) {
  const i = jc(l), r = l.ownerDocument.body, s = ri(l.scrollWidth, l.clientWidth, r.scrollWidth, r.clientWidth), c = ri(l.scrollHeight, l.clientHeight, r.scrollHeight, r.clientHeight);
  let f = -i.scrollLeft + kc(l);
  const m = -i.scrollTop;
  return Ml(r).direction === "rtl" && (f += ri(l.clientWidth, r.clientWidth) - s), {
    width: s,
    height: c,
    x: f,
    y: m
  };
}
const HA = 25;
function UA(l, i, r) {
  r === void 0 && (r = "viewport");
  const s = r === "layoutViewport", c = mn(l), f = di(l), m = c.visualViewport;
  let v = f.clientWidth, y = f.clientHeight, h = 0, p = 0;
  if (m) {
    const x = !x0() || i === "fixed";
    s ? x || (h = -m.offsetLeft, p = -m.offsetTop) : (v = m.width, y = m.height, x && (h = m.offsetLeft, p = m.offsetTop));
  }
  if (kc(f) <= 0) {
    const x = f.ownerDocument, T = x.body, A = getComputedStyle(T), N = x.compatMode === "CSS1Compat" && parseFloat(A.marginLeft) + parseFloat(A.marginRight) || 0, E = Math.abs(f.clientWidth - T.clientWidth - N), M = getComputedStyle(f).scrollbarGutter === "stable both-edges" ? E / 2 : E;
    M <= HA && (v -= M);
  }
  return {
    width: v,
    height: y,
    x: h,
    y: p
  };
}
function IA(l, i) {
  const r = Do(l, !0, i === "fixed"), s = r.top + l.clientTop, c = r.left + l.clientLeft, f = xr(l), m = l.clientWidth * f.x, v = l.clientHeight * f.y, y = c * f.x, h = s * f.y;
  return {
    width: m,
    height: v,
    x: y,
    y: h
  };
}
function Gb(l, i, r) {
  let s;
  if (i === "viewport" || i === "layoutViewport")
    s = UA(l, r, i);
  else if (i === "document")
    s = jA(di(l));
  else if (kn(i))
    s = IA(i, r);
  else {
    const c = D2(l);
    s = {
      x: i.x - c.x,
      y: i.y - c.y,
      width: i.width,
      height: i.height
    };
  }
  return yc(s);
}
function VA(l, i) {
  const r = i.get(l);
  if (r)
    return r;
  let s = Cr(l, [], !1).filter((v) => kn(v) && $n(v) !== "body"), c = null;
  const f = Ml(l).position === "fixed";
  let m = f ? Ki(l) : l;
  for (; kn(m) && !Yi(m); ) {
    const v = Ml(m), y = y0(m), h = c ? c.position : f ? "fixed" : "";
    !y && (h === "fixed" || h === "absolute" && v.position === "static") ? s = s.filter((g) => g !== m) : c = v, m = Ki(m);
  }
  return i.set(l, s), s;
}
function LA(l) {
  let {
    element: i,
    boundary: r,
    rootBoundary: s,
    strategy: c
  } = l;
  const m = [...r === "clippingAncestors" ? _c(i) ? [] : VA(i, this._c) : [].concat(r), s], v = Gb(i, m[0], c);
  let y = v.top, h = v.right, p = v.bottom, g = v.left;
  for (let x = 1; x < m.length; x++) {
    const T = Gb(i, m[x], c);
    y = ri(T.top, y), h = Rr(T.right, h), p = Rr(T.bottom, p), g = ri(T.left, g);
  }
  return {
    width: h - g,
    height: p - y,
    x: g,
    y
  };
}
function BA(l) {
  const {
    width: i,
    height: r
  } = N2(l);
  return {
    width: i,
    height: r
  };
}
function qA(l, i, r) {
  const s = kt(i), c = di(i), f = r === "fixed", m = Do(l, !0, f, i);
  let v = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const y = ui(0);
  if ((s || !f) && (($n(i) !== "body" || Nu(c)) && (v = jc(i)), s)) {
    const x = Do(i, !0, f, i);
    y.x = x.x + i.clientLeft, y.y = x.y + i.clientTop;
  }
  !s && c && (y.x = kc(c));
  const h = c && !s && !f ? z2(c, v) : ui(0), p = m.left + v.scrollLeft - y.x - h.x, g = m.top + v.scrollTop - y.y - h.y;
  return {
    x: p,
    y: g,
    width: m.width,
    height: m.height
  };
}
function Um(l) {
  return Ml(l).position === "static";
}
function Yb(l, i) {
  if (!kt(l) || Ml(l).position === "fixed")
    return null;
  if (i)
    return i(l);
  let r = l.offsetParent;
  return di(l) === r && (r = r.ownerDocument.body), r;
}
function _2(l, i) {
  const r = mn(l);
  if (_c(l))
    return r;
  if (!kt(l)) {
    let c = Ki(l);
    for (; c && !Yi(c); ) {
      if (kn(c) && !Um(c))
        return c;
      c = Ki(c);
    }
    return r;
  }
  let s = Yb(l, i);
  for (; s && cR(s) && Um(s); )
    s = Yb(s, i);
  return s && Yi(s) && Um(s) && !y0(s) ? r : s || mR(l) || r;
}
const GA = async function(l) {
  const i = this.getOffsetParent || _2, r = this.getDimensions, s = await r(l.floating);
  return {
    reference: qA(l.reference, await i(l.floating), l.strategy),
    floating: {
      x: 0,
      y: 0,
      width: s.width,
      height: s.height
    }
  };
};
function YA(l) {
  return Ml(l).direction === "rtl";
}
const kA = {
  convertOffsetParentRelativeRectToViewportRelativeRect: zA,
  getDocumentElement: di,
  getClippingRect: LA,
  getOffsetParent: _2,
  getElementRects: GA,
  getClientRects: _A,
  getDimensions: BA,
  getScale: xr,
  isElement: kn,
  isRTL: YA
};
function j2(l, i) {
  return l.x === i.x && l.y === i.y && l.width === i.width && l.height === i.height;
}
function XA(l, i, r) {
  let s = null, c;
  const f = di(l);
  function m() {
    var p;
    clearTimeout(c), (p = s) == null || p.disconnect(), s = null;
  }
  function v(p, g) {
    p === void 0 && (p = !1), g === void 0 && (g = 1), m();
    const x = l.getBoundingClientRect(), {
      left: T,
      top: A,
      width: N,
      height: E
    } = x;
    if (p || i(), !N || !E)
      return;
    const M = Ro(A), R = Ro(f.clientWidth - (T + N)), I = Ro(f.clientHeight - (A + E)), C = Ro(T), V = {
      rootMargin: -M + "px " + -R + "px " + -I + "px " + -C + "px",
      threshold: ri(0, Rr(1, g)) || 1
    };
    let _ = !0;
    function U(j) {
      const H = j[0].intersectionRatio;
      if (!j2(x, l.getBoundingClientRect()))
        return v();
      if (H !== g) {
        if (!_)
          return v();
        H ? v(!1, H) : c = setTimeout(() => {
          v(!1, 1e-7);
        }, 1e3);
      }
      _ = !1;
    }
    try {
      s = new IntersectionObserver(U, {
        ...V,
        // Handle <iframe>s
        root: f.ownerDocument
      });
    } catch {
      s = new IntersectionObserver(U, V);
    }
    s.observe(l);
  }
  const y = mn(l), h = () => v(r);
  return y.addEventListener("resize", h), v(!0), () => {
    y.removeEventListener("resize", h), m();
  };
}
function kb(l, i, r, s) {
  s === void 0 && (s = {});
  const {
    ancestorScroll: c = !0,
    ancestorResize: f = !0,
    elementResize: m = typeof ResizeObserver == "function",
    layoutShift: v = typeof IntersectionObserver == "function",
    animationFrame: y = !1
  } = s, h = B0(l), p = c || f ? [...h ? Cr(h) : [], ...i ? Cr(i) : []] : [];
  p.forEach((M) => {
    c && M.addEventListener("scroll", r), f && M.addEventListener("resize", r);
  });
  const g = h && v ? XA(h, r, f) : null;
  let x = -1, T = null;
  m && (T = new ResizeObserver((M) => {
    let [R] = M;
    R && R.target === h && T && i && (T.unobserve(i), cancelAnimationFrame(x), x = requestAnimationFrame(() => {
      var I;
      (I = T) == null || I.observe(i);
    })), r();
  }), h && !y && T.observe(h), i && T.observe(i));
  let A, N = y ? Do(l) : null;
  y && E();
  function E() {
    const M = Do(l);
    N && !j2(N, M) && r(), N = M, A = requestAnimationFrame(E);
  }
  return r(), () => {
    var M;
    p.forEach((R) => {
      c && R.removeEventListener("scroll", r), f && R.removeEventListener("resize", r);
    }), g?.(), (M = T) == null || M.disconnect(), T = null, y && cancelAnimationFrame(A);
  };
}
const KA = AA, PA = OA, QA = RA, ZA = MA, FA = wA, JA = (l, i, r) => {
  const s = /* @__PURE__ */ new Map(), c = r ?? {}, f = {
    ...kA,
    ...c.platform,
    _c: s
  };
  return CA(l, i, {
    ...c,
    platform: f
  });
};
var $A = typeof document < "u", WA = function() {
}, uc = $A ? b.useLayoutEffect : WA;
function Sc(l, i) {
  if (l === i)
    return !0;
  if (typeof l != typeof i)
    return !1;
  if (typeof l == "function" && l.toString() === i.toString())
    return !0;
  let r, s, c;
  if (l && i && typeof l == "object") {
    if (Array.isArray(l)) {
      if (r = l.length, r !== i.length) return !1;
      for (s = r; s-- !== 0; )
        if (!Sc(l[s], i[s]))
          return !1;
      return !0;
    }
    if (c = Object.keys(l), r = c.length, r !== Object.keys(i).length)
      return !1;
    for (s = r; s-- !== 0; )
      if (!{}.hasOwnProperty.call(i, c[s]))
        return !1;
    for (s = r; s-- !== 0; ) {
      const f = c[s];
      if (!(f === "_owner" && l.$$typeof) && !Sc(l[f], i[f]))
        return !1;
    }
    return !0;
  }
  return l !== l && i !== i;
}
function H2(l) {
  return typeof window > "u" ? 1 : (l.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function Xb(l, i) {
  const r = H2(l);
  return Math.round(i * r) / r;
}
function Im(l) {
  const i = b.useRef(l);
  return uc(() => {
    i.current = l;
  }), i;
}
function eO(l) {
  l === void 0 && (l = {});
  const {
    placement: i = "bottom",
    strategy: r = "absolute",
    middleware: s = [],
    platform: c,
    elements: {
      reference: f,
      floating: m
    } = {},
    transform: v = !0,
    whileElementsMounted: y,
    open: h
  } = l, [p, g] = b.useState({
    x: 0,
    y: 0,
    strategy: r,
    placement: i,
    middlewareData: {},
    isPositioned: !1
  }), [x, T] = b.useState(s);
  Sc(x, s) || T(s);
  const [A, N] = b.useState(null), [E, M] = b.useState(null), R = b.useCallback((P) => {
    P !== V.current && (V.current = P, N(P));
  }, []), I = b.useCallback((P) => {
    P !== _.current && (_.current = P, M(P));
  }, []), C = f || A, z = m || E, V = b.useRef(null), _ = b.useRef(null), U = b.useRef(p), j = y != null, H = Im(y), q = Im(c), $ = Im(h), Z = b.useCallback(() => {
    if (!V.current || !_.current)
      return;
    const P = {
      placement: i,
      strategy: r,
      middleware: x
    };
    q.current && (P.platform = q.current), JA(V.current, _.current, P).then((J) => {
      const te = {
        ...J,
        // The floating element's position may be recomputed while it's closed
        // but still mounted (such as when transitioning out). To ensure
        // `isPositioned` will be `false` initially on the next open, avoid
        // setting it to `true` when `open === false` (must be specified).
        isPositioned: $.current !== !1
      };
      G.current && !Sc(U.current, te) && (U.current = te, zo.flushSync(() => {
        g(te);
      }));
    });
  }, [x, i, r, q, $]);
  uc(() => {
    h === !1 && U.current.isPositioned && (U.current.isPositioned = !1, g((P) => ({
      ...P,
      isPositioned: !1
    })));
  }, [h]);
  const G = b.useRef(!1);
  uc(() => (G.current = !0, () => {
    G.current = !1;
  }), []), uc(() => {
    if (C && (V.current = C), z && (_.current = z), C && z) {
      if (H.current)
        return H.current(C, z, Z);
      Z();
    }
  }, [C, z, Z, H, j]);
  const le = b.useMemo(() => ({
    reference: V,
    floating: _,
    setReference: R,
    setFloating: I
  }), [R, I]), k = b.useMemo(() => ({
    reference: C,
    floating: z
  }), [C, z]), ie = b.useMemo(() => {
    const P = {
      position: r,
      left: 0,
      top: 0
    };
    if (!k.floating)
      return P;
    const J = Xb(k.floating, p.x), te = Xb(k.floating, p.y);
    return v ? {
      ...P,
      transform: "translate(" + J + "px, " + te + "px)",
      ...H2(k.floating) >= 1.5 && {
        willChange: "transform"
      }
    } : {
      position: r,
      left: J,
      top: te
    };
  }, [r, v, k.floating, p.x, p.y]);
  return b.useMemo(() => ({
    ...p,
    update: Z,
    refs: le,
    elements: k,
    floatingStyles: ie
  }), [p, Z, le, k, ie]);
}
const tO = (l, i) => {
  const r = KA(l);
  return {
    name: r.name,
    fn: r.fn,
    options: [l, i]
  };
}, nO = (l, i) => {
  const r = PA(l);
  return {
    name: r.name,
    fn: r.fn,
    options: [l, i]
  };
}, lO = (l, i) => ({
  fn: FA(l).fn,
  options: [l, i]
}), aO = (l, i) => {
  const r = QA(l);
  return {
    name: r.name,
    fn: r.fn,
    options: [l, i]
  };
}, iO = (l, i) => {
  const r = ZA(l);
  return {
    name: r.name,
    fn: r.fn,
    options: [l, i]
  };
};
function oO({
  store: l,
  parentContext: i,
  isDrawer: r
}) {
  const s = l.useState("open"), c = l.useState("mounted"), f = l.useState("disablePointerDismissal"), m = l.useState("modal"), v = l.useState("popupElement"), y = l.useState("floatingRootContext"), [h, p] = b.useState(0), [g, x] = b.useState(0), T = h === 0, A = x2(y, {
    outsidePressEvent() {
      return l.context.internalBackdropRef.current || l.context.backdropRef.current ? "intentional" : {
        mouse: m === "trap-focus" ? "sloppy" : "intentional",
        touch: "sloppy"
      };
    },
    outsidePress(N) {
      if (!l.context.outsidePressEnabledRef.current || "button" in N && N.button !== 0)
        return !1;
      if ("touches" in N) {
        if (N.type === "touchend") {
          if (N.changedTouches.length !== 1 || N.touches.length !== 0)
            return !1;
        } else if (N.touches.length !== 1)
          return !1;
      }
      const E = cl(N);
      if (T && !f) {
        if (m) {
          const M = l.context.internalBackdropRef.current, R = l.context.backdropRef.current;
          return M || R ? M === E || R === E || et(E, v) && !E?.hasAttribute("data-base-ui-portal") : !0;
        }
        return !0;
      }
      return !1;
    },
    escapeKey: T
  });
  return $y(s && m === !0, v), l.useContextCallback("onNestedDialogOpen", (N, E) => {
    !l.select("open") && !l.select("mounted") || (p(N), x(E));
  }), Te(() => {
    !s && !c && (p(0), x(0));
  }, [s, c]), Te(() => (i?.onNestedDialogOpen && s && i.onNestedDialogOpen(h + 1, g + (r ? 1 : 0)), () => {
    i?.onNestedDialogOpen && s && i.onNestedDialogOpen(0, 0);
  }), [r, s, h, g, i]), ZT(l, {
    // `enabled` is not passed to `useDismiss`, so its props are always defined,
    // and `trigger` is the same object as `reference`.
    activeTriggerProps: A.reference,
    inactiveTriggerProps: A.trigger,
    // DialogPopup and DrawerPopup spread `FOCUSABLE_POPUP_PROPS` directly, so
    // this only needs to carry the dismiss handlers.
    popupProps: A.floating,
    nestedOpenDialogCount: h,
    nestedOpenDrawerCount: g
  }), null;
}
const U2 = /* @__PURE__ */ b.createContext(void 0);
function Fi(l) {
  const i = b.useContext(U2);
  if (!l && i === void 0)
    throw new Error(Rn(27));
  return i;
}
const rO = {
  ...gA,
  modal: (l) => l.modal,
  nested: (l) => l.nested,
  nestedOpenDialogCount: (l) => l.nestedOpenDialogCount,
  nestedOpenDrawerCount: (l) => l.nestedOpenDrawerCount,
  disablePointerDismissal: (l) => l.disablePointerDismissal,
  openMethod: (l) => l.openMethod,
  descriptionElementId: (l) => l.descriptionElementId,
  titleElementId: (l) => l.titleElementId,
  viewportElement: (l) => l.viewportElement,
  role: (l) => l.role
};
class uO extends L0 {
  constructor(i, r, s) {
    const c = new C2(), f = sO(i, c, r, s);
    super(f, cO(c), rO);
  }
  setOpen = (i, r) => {
    r.preventUnmountOnClose = () => {
      this.set("preventUnmountingOnClose", !0);
    }, !i && r.trigger == null && this.state.activeTriggerId != null && (r.trigger = this.state.activeTriggerElement ?? void 0), this.context.onOpenChange?.(i, r), !r.isCanceled && (this.state.floatingRootContext.dispatchOpenChange(i, r), this.update(kT(this.state, i, r.trigger)));
  };
}
function sO(l, i, r, s = !1) {
  return {
    ...dA(i, r, s),
    modal: !0,
    disablePointerDismissal: !1,
    viewportElement: null,
    descriptionElementId: void 0,
    titleElementId: void 0,
    openMethod: null,
    nested: !1,
    nestedOpenDialogCount: 0,
    nestedOpenDrawerCount: 0,
    role: "dialog",
    ...l
  };
}
function cO(l) {
  return {
    popupRef: /* @__PURE__ */ b.createRef(),
    backdropRef: /* @__PURE__ */ b.createRef(),
    internalBackdropRef: /* @__PURE__ */ b.createRef(),
    outsidePressEnabledRef: {
      current: !0
    },
    triggerElements: l,
    onOpenChange: void 0,
    onOpenChangeComplete: void 0
  };
}
function fO(l, i) {
  const {
    children: r,
    open: s,
    defaultOpen: c = !1,
    onOpenChange: f,
    onOpenChangeComplete: m,
    disablePointerDismissal: v = !1,
    modal: y = !0,
    actionsRef: h,
    handle: p,
    triggerId: g,
    defaultTriggerId: x = null
  } = i, T = l === "drawer", A = y, N = v, E = "dialog", M = Fi(!0), R = M != null, I = {
    modal: A,
    disablePointerDismissal: N,
    nested: R,
    role: E
  }, C = qT((H, q) => new uO({
    open: c,
    openProp: s,
    activeTriggerId: x,
    triggerIdProp: g,
    ...I
  }, H, q), !0);
  C.useControlledProp("openProp", s), C.useControlledProp("triggerIdProp", g), C.useSyncedValues(I), C.useContextCallback("onOpenChange", f), C.useContextCallback("onOpenChangeComplete", m);
  const z = C.useState("open"), V = C.useState("mounted"), _ = C.useState("payload");
  FT(C, z), PT(C);
  const {
    forceUnmount: U
  } = QT(z, C);
  b.useImperativeHandle(h, () => ({
    unmount: U,
    close: () => C.setOpen(!1, it(Gy))
  }), [U, C]);
  const j = z || V || p != null;
  return /* @__PURE__ */ w.jsxs(U2.Provider, {
    value: C,
    children: [p && /* @__PURE__ */ w.jsx(GT, {
      handle: p,
      store: C
    }), j && /* @__PURE__ */ w.jsx(oO, {
      store: C,
      parentContext: M?.context,
      isDrawer: T
    }), typeof r == "function" ? r({
      payload: _
    }) : r]
  });
}
const dO = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    forceRender: m = !1,
    ...v
  } = i, y = Fi(), h = y.useState("open"), p = y.useState("nested"), g = y.useState("mounted"), x = y.useState("transitionStatus");
  return Tt("div", i, {
    state: {
      open: h,
      transitionStatus: x
    },
    ref: [y.context.backdropRef, r],
    stateAttributesMapping: rT,
    props: [{
      role: "presentation",
      hidden: !g,
      style: {
        userSelect: "none",
        WebkitUserSelect: "none"
      }
    }, v],
    enabled: m || !p
  });
}), I2 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    disabled: m = !1,
    nativeButton: v = !0,
    ...y
  } = i, h = Fi(), p = h.useState("open"), {
    getButtonProps: g,
    buttonRef: x
  } = Ua({
    disabled: m,
    native: v
  }), T = {
    disabled: m
  };
  function A(N) {
    p && h.setOpen(!1, it(qy, N.nativeEvent));
  }
  return Tt("button", i, {
    state: T,
    ref: [r, x],
    props: [{
      onClick: A
    }, y, g]
  });
}), mO = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    id: m,
    ...v
  } = i, y = Fi(), h = wl(m);
  return y.useSyncedValueWithCleanup("descriptionElementId", h), Tt("p", i, {
    ref: r,
    props: [{
      id: h
    }, v]
  });
}), V2 = /* @__PURE__ */ b.createContext(void 0);
function gO() {
  const l = b.useContext(V2);
  if (l === void 0)
    throw new Error(Rn(26));
  return l;
}
const t0 = "ArrowUp", n0 = "ArrowDown", l0 = "ArrowLeft", a0 = "ArrowRight", i0 = "Home", o0 = "End", L2 = /* @__PURE__ */ new Set([t0, n0, l0, a0, i0, o0]), B2 = "Shift", hO = [B2, "Control", "Alt", "Meta"];
function pO(l) {
  return kt(l) && l.tagName === "INPUT";
}
function Kb(l) {
  return !!(pO(l) && l.selectionStart != null || kt(l) && l.tagName === "TEXTAREA");
}
function Pb(l, i, r, s) {
  if (!l || !i || !i.scrollTo)
    return;
  let c = l.scrollLeft, f = l.scrollTop;
  const m = l.clientWidth < l.scrollWidth, v = l.clientHeight < l.scrollHeight;
  if (m && s !== "vertical") {
    const y = Qb(l, i, "left"), h = nc(l), p = nc(i);
    r === "ltr" && (y + i.offsetWidth + p.scrollMarginRight > l.scrollLeft + l.clientWidth - h.scrollPaddingRight ? c = y + i.offsetWidth + p.scrollMarginRight - l.clientWidth + h.scrollPaddingRight : y - p.scrollMarginLeft < l.scrollLeft + h.scrollPaddingLeft && (c = y - p.scrollMarginLeft - h.scrollPaddingLeft)), r === "rtl" && (y - p.scrollMarginLeft < l.scrollLeft + h.scrollPaddingLeft ? c = y - p.scrollMarginLeft - h.scrollPaddingLeft : y + i.offsetWidth + p.scrollMarginRight > l.scrollLeft + l.clientWidth - h.scrollPaddingRight && (c = y + i.offsetWidth + p.scrollMarginRight - l.clientWidth + h.scrollPaddingRight));
  }
  if (v && s !== "horizontal") {
    const y = Qb(l, i, "top"), h = nc(l), p = nc(i);
    y - p.scrollMarginTop < l.scrollTop + h.scrollPaddingTop ? f = y - p.scrollMarginTop - h.scrollPaddingTop : y + i.offsetHeight + p.scrollMarginBottom > l.scrollTop + l.clientHeight - h.scrollPaddingBottom && (f = y + i.offsetHeight + p.scrollMarginBottom - l.clientHeight + h.scrollPaddingBottom);
  }
  l.scrollTo({
    left: c,
    top: f,
    behavior: "auto"
  });
}
function Qb(l, i, r) {
  const s = r === "left" ? "offsetLeft" : "offsetTop";
  let c = 0;
  for (; i.offsetParent && (c += i[s], i.offsetParent !== l); )
    i = i.offsetParent;
  return c;
}
function nc(l) {
  const i = getComputedStyle(l);
  return {
    scrollMarginTop: parseFloat(i.scrollMarginTop) || 0,
    scrollMarginRight: parseFloat(i.scrollMarginRight) || 0,
    scrollMarginBottom: parseFloat(i.scrollMarginBottom) || 0,
    scrollMarginLeft: parseFloat(i.scrollMarginLeft) || 0,
    scrollPaddingTop: parseFloat(i.scrollPaddingTop) || 0,
    scrollPaddingRight: parseFloat(i.scrollPaddingRight) || 0,
    scrollPaddingBottom: parseFloat(i.scrollPaddingBottom) || 0,
    scrollPaddingLeft: parseFloat(i.scrollPaddingLeft) || 0
  };
}
const vO = "--nested-dialogs", bO = "data-nested-dialog-open", yO = {
  ...Vc,
  ...Qi,
  nestedDialogOpen(l) {
    return l ? {
      [bO]: ""
    } : null;
  }
}, xO = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    finalFocus: m,
    initialFocus: v,
    ...y
  } = i, h = Fi(), p = h.useState("descriptionElementId"), g = h.useState("disablePointerDismissal"), x = h.useState("floatingRootContext"), T = h.useState("popupProps"), A = h.useState("modal"), N = h.useState("mounted"), E = h.useState("nested"), M = h.useState("nestedOpenDialogCount"), R = h.useState("open"), I = h.useState("openMethod"), C = h.useState("titleElementId"), z = h.useState("transitionStatus"), V = h.useState("role"), _ = x.useState("floatingId");
  gO(), Zi({
    open: R,
    ref: h.context.popupRef,
    onComplete() {
      R && h.context.onOpenChangeComplete?.(!0);
    }
  });
  const U = v === void 0 ? BT(h.context.popupRef) : v, j = M > 0, H = h.useStateSetter("popupElement"), $ = Tt("div", i, {
    state: {
      open: R,
      nested: E,
      transitionStatus: z,
      nestedDialogOpen: j
    },
    props: [T, {
      id: _,
      "aria-labelledby": C,
      "aria-describedby": p,
      role: V,
      ...E2,
      hidden: !N,
      onKeyDown(Z) {
        L2.has(Z.key) && Z.stopPropagation();
      },
      style: {
        [vO]: M
      }
    }, y],
    ref: [r, h.context.popupRef, H],
    stateAttributesMapping: yO
  });
  return /* @__PURE__ */ w.jsx(y2, {
    context: x,
    openInteractionType: I,
    disabled: !N,
    closeOnFocusOut: !g,
    initialFocus: U,
    returnFocus: m,
    modal: A !== !1,
    restoreFocus: "popup",
    children: $
  });
});
function q0(l) {
  return d0(19) ? l : l ? "true" : void 0;
}
const q2 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    cutout: s,
    ...c
  } = i;
  let f;
  if (s) {
    const m = s.getBoundingClientRect();
    f = `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${m.left}px ${m.top}px,${m.left}px ${m.bottom}px,${m.right}px ${m.bottom}px,${m.right}px ${m.top}px,${m.left}px ${m.top}px)`;
  }
  return /* @__PURE__ */ w.jsx("div", {
    ref: r,
    role: "presentation",
    "data-base-ui-inert": "",
    ...c,
    style: {
      position: "fixed",
      inset: 0,
      userSelect: "none",
      WebkitUserSelect: "none",
      clipPath: f
    }
  });
}), SO = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    keepMounted: s = !1,
    ...c
  } = i, f = Fi(), m = f.useState("mounted"), v = f.useState("modal"), y = f.useState("open");
  return m || s ? /* @__PURE__ */ w.jsx(V2.Provider, {
    value: s,
    children: /* @__PURE__ */ w.jsxs(b2, {
      ref: r,
      ...c,
      children: [m && v === !0 && /* @__PURE__ */ w.jsx(q2, {
        ref: f.context.internalBackdropRef,
        inert: q0(!y)
      }), i.children]
    })
  }) : null;
}), EO = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    id: m,
    ...v
  } = i, y = Fi(), h = wl(m);
  return y.useSyncedValueWithCleanup("titleElementId", h), Tt("h2", i, {
    ref: r,
    props: [{
      id: h
    }, v]
  });
});
function CO(l) {
  const i = b.useRef(""), r = b.useCallback((c) => {
    c.defaultPrevented || (i.current = c.pointerType, l(c, c.pointerType));
  }, [l]);
  return {
    onClick: b.useCallback((c) => {
      if (c.detail === 0) {
        l(c, "keyboard");
        return;
      }
      "pointerType" in c ? l(c, c.pointerType) : l(c, i.current), i.current = "";
    }, [l]),
    onPointerDown: r
  };
}
function oi(l, i) {
  const r = b.useRef(l), s = Re(i);
  Te(() => {
    r.current !== l && s(r.current), r.current = l;
  }, [l, s]);
}
function G2(l, i) {
  const r = Re((f, m) => {
    (typeof l == "function" ? l() : l) || i(m || // On iOS Safari, the hitslop around touch targets means tapping outside an element's
    // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
    // will be "" in that case.
    (Du ? "touch" : ""));
  }), {
    onClick: s,
    onPointerDown: c
  } = CO(r);
  return b.useMemo(() => ({
    onClick: s,
    onPointerDown: c
  }), [s, c]);
}
function RO(l) {
  const [i, r] = b.useState(null), s = G2(l, r);
  return oi(l, (c) => {
    c && !l && r(null);
  }), b.useMemo(() => ({
    openMethod: i,
    triggerProps: s
  }), [i, s]);
}
const TO = lA(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    disabled: m = !1,
    nativeButton: v = !0,
    id: y,
    payload: h,
    handle: p,
    ...g
  } = i, x = Fi(!0), A = hA(p) ?? x;
  if (!A)
    throw new Error(Rn(79));
  const N = wl(y), E = A.useState("floatingRootContext"), M = A.useState("isOpenedByTrigger", N), R = A.useState("triggerPopupId", N), I = b.useRef(null), {
    registerTrigger: C,
    isMountedByThisTrigger: z
  } = KT(N, I, A, {
    payload: h
  }), {
    getButtonProps: V,
    buttonRef: _
  } = Ua({
    disabled: m,
    native: v
  }), U = I0(E), j = G2(() => A.select("open"), ($) => {
    A.set("openMethod", $);
  }), H = {
    disabled: m,
    open: M
  }, q = A.useState("triggerProps", z);
  return Tt("button", i, {
    state: H,
    ref: [_, r, C, I],
    props: [U.reference, q, j, {
      [h2]: "",
      id: N,
      "aria-haspopup": "dialog",
      "aria-expanded": M,
      "aria-controls": R
    }, g, V],
    stateAttributesMapping: e2
  });
});
function AO(l) {
  const i = b.useRef(!0);
  i.current && (i.current = !1, l());
}
function OO(l, i, r, s, c, f, m, v, y, h = 2) {
  const p = bT(r.current, {
    event: l,
    orientation: s,
    loopFocus: c,
    rtl: f,
    cols: h,
    disabledIndices: m,
    minIndex: v,
    maxIndex: y,
    // An out-of-range previous index falls back to the first enabled item.
    prevIndex: i > y ? v : i,
    stopEvent: !0
  });
  return si(r.current, p) ? void 0 : p;
}
function G0(l) {
  return l == null ? Yn : l.type.startsWith("key") ? XC : l.type.startsWith("mouse") || l.type.startsWith("pointer") ? KC : Yn;
}
const Y2 = /* @__PURE__ */ b.createContext(void 0), k2 = /* @__PURE__ */ b.createContext(void 0), X2 = /* @__PURE__ */ b.createContext(void 0), K2 = /* @__PURE__ */ b.createContext(!1), P2 = /* @__PURE__ */ b.createContext("");
function Bl() {
  const l = b.useContext(Y2);
  if (!l)
    throw new Error(Rn(22));
  return l;
}
function Xc() {
  const l = b.useContext(k2);
  if (!l)
    throw new Error(Rn(23));
  return l;
}
function zu() {
  const l = b.useContext(X2);
  if (!l)
    throw new Error(Rn(24));
  return l;
}
function Y0() {
  return b.useContext(P2);
}
function wO() {
  return b.useContext(K2);
}
function MO(l, i, r = Object.is) {
  const {
    length: s
  } = l;
  if (s !== i.length)
    return !1;
  for (let c = 0; c < s; c += 1)
    if (!r(l[c], i[c]))
      return !1;
  return !0;
}
const k0 = (l, i) => Object.is(l, i);
function ci(l, i, r) {
  return l == null || i == null ? Object.is(l, i) : r(l, i);
}
function NO(l, i, r) {
  return Array.isArray(l) && Array.isArray(i) ? !MO(l, i, (s, c) => ci(s, c, r)) : l !== i;
}
function Ec(l, i, r) {
  return l ? l.some((s) => s === void 0 ? !1 : ci(i, s, r)) : !1;
}
function X0(l, i, r) {
  return l ? l.findIndex((s) => s === void 0 ? !1 : ci(s, i, r)) : -1;
}
function DO(l, i) {
  if (i !== k0)
    return (s) => Ec(l, s, i);
  const r = new Set(l);
  return r.delete(void 0), (s) => r.has(s) && (s !== 0 || l.some((c) => Object.is(s, c)));
}
function sc(l, i, r, s) {
  const c = s && Array.isArray(i) ? (
    // Anchor to the first selected item in rendered order so the index does not depend
    // on the order in which the values were added to the array.
    l.findIndex(DO(i, r))
  ) : X0(l, i, r);
  return c === -1 ? null : c;
}
function zO(l, i, r, s, c, f) {
  return Ec(s, i, c) ? f != null && l > f && Ec(s, r[f], c) ? f : l : l === f ? sc(r, s, c, !0) : f;
}
function _O(l, i, r) {
  return l.filter((s) => !ci(i, s, r));
}
function Cc(l) {
  if (l == null)
    return "";
  if (typeof l == "string")
    return l;
  try {
    return JSON.stringify(l);
  } catch {
    return String(l);
  }
}
function jO(l) {
  return typeof l == "object" && l != null && Array.isArray(l.items);
}
function K0(l) {
  return jO(l?.[0]);
}
function Vm(l) {
  return K0(l) ? l.flatMap((i) => i.items) : l;
}
function HO(l) {
  if (!Array.isArray(l))
    return l != null && "null" in l;
  const i = l;
  if (K0(i)) {
    for (const r of i)
      for (const s of r.items)
        if (s && s.value == null && s.label != null)
          return !0;
    return !1;
  }
  for (const r of i)
    if (r && r.value == null && r.label != null)
      return !0;
  return !1;
}
function Sr(l, i) {
  if (i && l != null)
    return i(l) ?? "";
  if (l && typeof l == "object") {
    if ("label" in l && l.label != null)
      return String(l.label);
    if ("value" in l)
      return String(l.value);
  }
  return Cc(l);
}
function yu(l, i) {
  return i && l != null ? i(l) ?? "" : l && typeof l == "object" && "value" in l && "label" in l ? Cc(l.value) : Cc(l);
}
const UO = {
  id: (l) => l.id,
  labelId: (l) => l.labelId,
  items: (l) => l.items,
  selectedValue: (l) => l.selectedValue,
  hasSelectionChips: (l) => {
    const i = l.selectedValue;
    return Array.isArray(i) && i.length > 0;
  },
  hasSelectedValue: (l) => {
    const {
      selectedValue: i,
      selectionMode: r
    } = l;
    return i == null ? !1 : r === "multiple" && Array.isArray(i) ? i.length > 0 : !0;
  },
  hasNullItemLabel: (l, i) => i ? HO(l.items) : !1,
  open: (l) => l.open,
  mounted: (l) => l.mounted,
  forceMounted: (l) => l.forceMounted,
  inline: (l) => l.inline,
  activeIndex: (l) => l.activeIndex,
  selectedIndex: (l) => l.selectedIndex,
  isActive: (l, i) => l.activeIndex === i,
  isSelected: (l, i) => {
    const r = l.isItemEqualToValue, s = l.selectedValue;
    return Array.isArray(s) ? s.some((c) => ci(i, c, r)) : ci(i, s, r);
  },
  transitionStatus: (l) => l.transitionStatus,
  popupProps: (l) => l.popupProps,
  listProps: (l) => l.listProps,
  inputProps: (l) => l.inputProps,
  triggerProps: (l) => l.triggerProps,
  itemRoot: (l) => l.itemRoot,
  positionerElement: (l) => l.positionerElement,
  listElement: (l) => l.listElement,
  popupId: (l) => l.popupId,
  triggerElement: (l) => l.triggerElement,
  inputElement: (l) => l.inputElement,
  inputGroupElement: (l) => l.inputGroupElement,
  popupSide: (l) => l.popupSide,
  openMethod: (l) => l.openMethod,
  inputInsidePopup: (l) => l.inputInsidePopup,
  inputOwnsFormValue: (l) => l.inputOwnsFormValue,
  selectionMode: (l) => l.selectionMode,
  name: (l) => l.name,
  form: (l) => l.form,
  disabled: (l) => l.disabled,
  readOnly: (l) => l.readOnly,
  required: (l) => l.required,
  grid: (l) => l.grid,
  virtualized: (l) => l.virtualized,
  itemToStringLabel: (l) => l.itemToStringLabel,
  isItemEqualToValue: (l) => l.isItemEqualToValue,
  modal: (l) => l.modal,
  autoHighlight: (l) => l.autoHighlight
}, IO = "data-valid", VO = "data-invalid", LO = {
  badInput: !1,
  customError: !1,
  patternMismatch: !1,
  rangeOverflow: !1,
  rangeUnderflow: !1,
  stepMismatch: !1,
  tooLong: !1,
  tooShort: !1,
  typeMismatch: !1,
  valid: null,
  valueMissing: !1
}, Q2 = {
  valid: null,
  touched: !1,
  dirty: !1,
  filled: !1,
  focused: !1
}, BO = {
  disabled: !1,
  ...Q2
}, Kc = {
  valid(l) {
    return l === null ? null : l ? {
      [IO]: ""
    } : {
      [VO]: ""
    };
  }
}, Z2 = {
  invalid: void 0,
  name: void 0,
  validityData: {
    state: LO,
    errors: [],
    error: "",
    value: "",
    initialValue: null
  },
  setValidityData: zt,
  disabled: void 0,
  setTouched: zt,
  setDirty: zt,
  setFilled: zt,
  setFocused: zt,
  focusOwnerRef: {
    current: void 0
  },
  validationMode: "onSubmit",
  shouldValidateOnChange: () => !1,
  state: BO,
  registerFieldControl: zt,
  validation: {
    getValidationProps: (l, i = un) => i,
    inputRef: {
      current: null
    },
    registeredInputs: /* @__PURE__ */ new Map(),
    registerInput: zt,
    getInputControl: () => null,
    commit: async () => {
    },
    change: zt
  }
}, F2 = /* @__PURE__ */ b.createContext(Z2);
function mi(l = !0) {
  const i = b.useContext(F2);
  if (i.setValidityData === zt && !l)
    throw new Error(Rn(28));
  return i;
}
function P0(l, i, r, s, c = !0, f) {
  const {
    registerFieldControl: m
  } = mi(), v = fl(() => /* @__PURE__ */ Symbol());
  Te(() => {
    const y = v.current;
    if (!c) {
      m(y, void 0);
      return;
    }
    m(y, {
      controlRef: l,
      getValue: s,
      id: i,
      name: f,
      value: r
    });
  }, [l, c, s, i, f, m, v, r]), Te(() => {
    const y = v.current;
    return () => {
      m(y, void 0);
    };
  }, [m, v]);
}
const qO = /* @__PURE__ */ b.createContext({
  elementRef: {
    current: null
  },
  formRef: {
    current: {
      fields: /* @__PURE__ */ new Map()
    }
  },
  errors: {},
  clearErrors: zt,
  validationMode: "onSubmit",
  submitCountRef: {
    current: 0
  }
});
function Q0() {
  return b.useContext(qO);
}
const GO = /* @__PURE__ */ b.createContext({
  controlId: void 0,
  registerControlId: zt,
  resetControlId: zt,
  labelId: void 0,
  setLabelId: zt,
  messageIds: [],
  setMessageIds: zt,
  getDescriptionProps: (l) => l
});
function Or() {
  return b.useContext(GO);
}
function Pc(l = {}) {
  const {
    id: i,
    enabled: r = !0
  } = l, {
    controlId: s,
    registerControlId: c,
    resetControlId: f
  } = Or(), m = wl(), v = fl(() => /* @__PURE__ */ Symbol()), y = b.useRef(!1), h = b.useRef(!1), p = Re(() => {
    !y.current || c === zt || (y.current = !1, c(v.current, void 0));
  });
  return Te(() => {
    if (!r || c === zt) {
      p();
      return;
    }
    let g;
    if (i !== void 0)
      h.current = !0, g = i;
    else if (h.current)
      g = m;
    else {
      f();
      return;
    }
    if (g === void 0) {
      p();
      return;
    }
    y.current = !0, c(v.current, g);
  }, [i, r, c, f, m, v, p]), Te(() => p, [p]), (r ? s : void 0) ?? i ?? m;
}
function J2(l) {
  return l == null ? void 0 : `${l}-popup`;
}
function YO(l, i) {
  return (r, s) => r == null ? !1 : l.contains(r, s, i);
}
function $2(l) {
  return Array.isArray(l) ? l.map((i) => $2(i)).join(",") : l == null ? "" : String(l);
}
const Zb = /* @__PURE__ */ new Map();
function kO(l = {}) {
  const {
    locale: i,
    ...r
  } = l, s = {
    usage: "search",
    sensitivity: "base",
    ignorePunctuation: !0,
    ...r
  }, c = `${$2(i)}|${JSON.stringify(s)}`, f = Zb.get(c);
  if (f)
    return f;
  const m = new Intl.Collator(i, s), v = {
    contains(y, h, p) {
      if (!h)
        return !0;
      const g = Sr(y, p);
      for (let x = 0; x <= g.length - h.length; x += 1)
        if (m.compare(g.slice(x, x + h.length), h) === 0)
          return !0;
      return !1;
    },
    startsWith(y, h, p) {
      if (!h)
        return !0;
      const g = Sr(y, p);
      return m.compare(g.slice(0, h.length), h) === 0;
    },
    endsWith(y, h, p) {
      if (!h)
        return !0;
      const g = Sr(y, p), x = h.length;
      return g.length >= x && m.compare(g.slice(g.length - x), h) === 0;
    }
  };
  return Zb.set(c, v), v;
}
const XO = kO;
function KO(l, i = !1) {
  const {
    overflowY: r
  } = Ml(l);
  return r !== "auto" && r !== "scroll" ? !1 : i ? l.clientHeight > 0 : l.scrollHeight > l.clientHeight;
}
const W2 = /* @__PURE__ */ Symbol("none"), Lm = {
  value: W2,
  index: -1
}, PO = /* @__PURE__ */ b.createContext(void 0);
function Qc() {
  return b.useContext(PO)?.direction ?? "ltr";
}
function QO(l, i, r) {
  const s = l.get(i);
  if (s !== void 0 || r === k0)
    return s;
  for (const [c, f] of l)
    if (ci(c, i, r))
      return f;
}
function ZO(l) {
  const {
    id: i,
    onOpenChangeComplete: r,
    defaultSelectedValue: s = null,
    selectedValue: c,
    onSelectedValueChange: f,
    defaultInputValue: m,
    inputValue: v,
    open: y,
    defaultOpen: h = !1,
    selectionMode: p,
    onItemHighlighted: g,
    name: x,
    form: T,
    disabled: A = !1,
    readOnly: N = !1,
    required: E = !1,
    inputRef: M,
    grid: R = !1,
    items: I,
    filteredItems: C,
    filter: z,
    filterQuery: V,
    openOnInputClick: _ = !0,
    autoHighlight: U = !1,
    keepHighlight: j = !1,
    highlightItemOnHover: H = !0,
    loopFocus: q = !0,
    itemToStringLabel: $,
    itemToStringValue: Z,
    isItemEqualToValue: G = k0,
    virtualized: le = !1,
    inline: k = !1,
    fillInputOnItemPress: ie = !0,
    modal: P = !1,
    limit: J = -1,
    autoComplete: te = "list",
    formAutoComplete: De,
    locale: ge,
    submitOnItemClick: ze = !1
  } = l, {
    clearErrors: O
  } = Q0(), {
    setDirty: B,
    validityData: ce,
    setFilled: oe,
    name: ye,
    disabled: de,
    setTouched: Ae,
    setFocused: pe,
    validationMode: xe,
    validation: Ke
  } = mi(), Ue = Qc(), Le = Pc({
    id: i
  }), Se = XO({
    locale: ge
  }), be = Array.isArray(I) ? null : I;
  if (be && typeof be.label != "function")
    throw new Error(Rn(100));
  const Ne = be ? be.data : I, Ee = be?.value, Ye = Ee ? void 0 : Ne, re = b.useMemo(() => {
    if (!C || !Ee)
      return;
    const he = Vm(C), ve = he.map(Ee);
    let We;
    return {
      values: ve,
      findItem(mt, Mt) {
        if (!We) {
          We = /* @__PURE__ */ new Map();
          for (let an = 0; an < ve.length; an += 1)
            We.has(ve[an]) || We.set(ve[an], he[an]);
        }
        return QO(We, mt, Mt);
      }
    };
  }, [C, Ee]), Me = b.useMemo(() => be ? (he) => be.label(he, G, (ve) => {
    const We = re?.findItem(ve, G);
    return We != null ? be.itemLabel(We) : Sr(ve, $);
  }) : $, [be, $, re, G]), je = b.useMemo(() => be ? Object.assign((he) => be.itemLabel(he), {
    selected: (he) => Sr(he, Me)
  }) : $, [be, Me, $]);
  function Pe(he) {
    return Sr(he, Me);
  }
  const [ne, ae] = b.useState(!1), [He, Ce] = b.useState(null), Oe = b.useRef(He), St = b.useRef([]), Ct = b.useRef([]), At = b.useRef(null), ft = b.useRef(null), Wn = b.useRef(null), ql = b.useRef(null), yl = b.useRef(null), el = b.useRef(!1), Wl = b.useRef(null), Zt = b.useRef(null), tl = b.useRef(null), Tn = b.useRef(Lm), $t = b.useRef(null), Bt = b.useRef([]), ma = b.useRef(null), en = de || A, nt = ye ?? x, Rt = p === "multiple", Ot = p === "single", dt = v !== void 0 || m !== void 0, lt = Ne !== void 0, pt = C !== void 0;
  let jt;
  U === "always" ? jt = "always" : jt = U ? "input-change" : !1;
  const [at, dl] = To({
    controlled: c,
    default: Rt ? s ?? Vl : s,
    name: "Combobox",
    state: "selectedValue"
  }), sn = b.useMemo(() => z === null ? () => !0 : z !== void 0 ? z : YO(Se, je), [z, Se, je]), An = fl(() => dt ? m ?? "" : Ot ? Pe(at) : "").current, [vt, nl] = To({
    controlled: v,
    default: An,
    name: "Combobox",
    state: "inputValue"
  }), [ut, ml] = To({
    controlled: y,
    default: h,
    name: "Combobox",
    state: "open"
  }), Nl = K0(Ne), _n = !ut && He !== null ? He : String(vt).trim(), On = Ot ? Pe(at) : "", Ia = Ot && !ne && _n !== "" && On.length === _n.length && Se.contains(On, _n), ll = Ia ? "" : V ?? _n, Va = lt && pt && Ia && (!be || be.hasValue(at, G)), al = b.useMemo(() => Ne ? Vm(Ne) : Vl, [Ne]), Gl = b.useMemo(() => {
    if (C && !Va)
      return C;
    if (!Ne)
      return Vl;
    if (Nl) {
      const ve = Ne, We = [];
      let mt = 0;
      for (const Mt of ve) {
        if (J > -1 && mt >= J)
          break;
        const an = J > -1 ? J - mt : 1 / 0, Ht = ll === "" ? Mt.items.slice(0, an) : [];
        if (ll !== "")
          for (const on of Mt.items) {
            if (Ht.length >= an)
              break;
            sn(on, ll, je) && Ht.push(on);
          }
        if (Ht.length > 0) {
          const on = {
            ...Mt,
            items: Ht
          };
          We.push(on), mt += Ht.length;
        }
      }
      return We;
    }
    if (ll === "")
      return J > -1 ? al.slice(0, J) : (
        // The cast here is done as `flatItems` is readonly.
        // valuesRef.current, a mutable ref, can be set to `flatFilteredValues`, which may
        // reference this exact readonly value, creating a mutation risk.
        // However, <Combobox.Item> can never mutate this value as the mutating effect
        // bails early when `items` is provided, and this is only ever returned
        // when `items` is provided due to the early return at the top of this hook.
        al
      );
    const he = [];
    for (const ve of al) {
      if (J > -1 && he.length >= J)
        break;
      sn(ve, ll, je) && he.push(ve);
    }
    return he;
  }, [C, Va, Ne, Nl, ll, J, sn, je, al]), tn = b.useMemo(() => {
    if (re && Gl === C)
      return re.values;
    const he = Vm(Gl);
    return Ee ? he.map((ve) => Ee(ve)) : he;
  }, [Gl, C, re, Ee]), Ie = fl(() => {
    let he = null;
    return k && ut && lt && p !== "none" && (he = sc(tn, at, G, Rt)), new L0({
      id: Le,
      labelId: void 0,
      selectedValue: at,
      open: ut,
      items: Ye,
      selectionMode: p,
      name: nt,
      form: T,
      disabled: en,
      readOnly: N,
      required: E,
      grid: R,
      virtualized: le,
      openOnInputClick: _,
      itemToStringLabel: Me,
      isItemEqualToValue: G,
      modal: P,
      autoHighlight: jt,
      submitOnItemClick: ze,
      hasInputValue: dt,
      mounted: !1,
      forceMounted: !1,
      transitionStatus: "idle",
      inline: k,
      activeIndex: null,
      selectedIndex: he,
      popupProps: {},
      listProps: {},
      inputProps: {},
      triggerProps: {},
      itemRoot: {
        props: un,
        id: Le,
        selectionMode: p,
        disabled: en,
        readOnly: N,
        isItemEqualToValue: G
      },
      positionerElement: null,
      listElement: null,
      popupId: void 0,
      triggerElement: null,
      inputElement: null,
      inputGroupElement: null,
      popupSide: null,
      openMethod: null,
      inputInsidePopup: !0,
      // Avoid duplicate names in the server HTML. Popup inputs aren't rendered
      // until after hydration, so the hidden input takes over then if needed.
      inputOwnsFormValue: p === "none"
    }, {
      // Placeholder callbacks replaced on first render
      onOpenChangeComplete: zt,
      setOpen: zt,
      setInputValue: zt,
      setSelectedValue: zt,
      setIndices: zt,
      handleSelection: zt,
      forceMount: zt,
      requestSubmit: zt,
      listRef: St,
      labelsRef: Ct,
      popupRef: At,
      emptyRef: yl,
      inputRef: ft,
      startDismissRef: Wn,
      endDismissRef: ql,
      chipsContainerRef: Wl,
      clearRef: Zt,
      valuesRef: Bt,
      pointerDownItemRef: ma,
      selectionEventRef: tl
    }, UO);
  }).current, wn = p === "none" ? vt : at, xl = b.useMemo(() => p === "none" ? wn : Array.isArray(at) ? at.map((he) => yu(he, Z)) : yu(at, Z), [wn, Z, p, at]), La = Re(g), nn = Re(r), Xt = Ie.useState("activeIndex"), Mn = Ie.useState("selectedIndex"), jn = Ie.useState("positionerElement"), gi = Ie.useState("listElement"), Yl = Ie.useState("triggerElement"), ea = Ie.useState("inputElement"), ga = Ie.useState("inputGroupElement"), Ft = Ie.useState("inline"), Hn = Ie.useState("inputInsidePopup"), hi = Ie.useState("inputOwnsFormValue"), Sl = Ot && !Hn && vt === On, Ba = sl(Yl), {
    openMethod: W,
    triggerProps: fe
  } = RO(ut), me = Re(() => xl);
  P0(Hn ? Ba : ft, Le, wn, me, !en, x);
  const Be = Re(() => {
    Ne ? Ct.current = tn.map(Pe) : Ie.set("forceMounted", !0);
  }), Qe = Re((he, ve, We, mt) => {
    if (ve === -1) {
      if (Tn.current === Lm)
        return;
      Tn.current = Lm;
    } else
      Tn.current = {
        value: he,
        index: ve
      };
    La(he, GC(We, mt, {
      index: ve
    }));
  }), qe = Re((he) => {
    const ve = {};
    he.activeIndex !== void 0 && (ve.activeIndex = he.activeIndex), he.selectedIndex !== void 0 && (ve.selectedIndex = he.selectedIndex), Ie.update(ve);
    const We = he.activeIndex;
    if (We === void 0)
      return;
    const mt = he.type || Yn;
    We === null ? Qe(void 0, -1, mt, he.event) : Qe(Bt.current[We], We, mt, he.event);
  }), Ze = Re((he, ve) => {
    if (l.onInputValueChange?.(he, ve), !ve.isCanceled) {
      if (el.current = ve.reason === Na, ve.reason === br) {
        ut && He !== null && Ce(null);
        const We = ve.event, mt = We.inputType;
        if (We.type === "compositionend" || mt != null && mt !== "" && mt !== "insertReplacementText") {
          const an = he.trim() !== "";
          an && ae(!0), $t.current = {
            hasQuery: an
          };
          const Ht = Ie.state.listElement;
          if (!Ie.state.virtualized && Ht) {
            const on = At.current;
            for (const Vn of Cr(Ht.firstElementChild ?? Ht)) {
              if (!kt(Vn) || (on ? !et(on, Vn) : Vn.getAttribute("role") === "dialog"))
                break;
              if (KO(Vn)) {
                Vn.scrollTop = 0;
                break;
              }
            }
          }
          an && jt && Ie.state.activeIndex == null && (ut || Ft) && Ie.set("activeIndex", 0);
        }
      } else ve.reason === Na && he === "" && Ie.state.inputInsidePopup && ($t.current = {
        hasQuery: !1,
        selection: !0
      });
      nl(he);
    }
  }), Nt = Re((he) => {
    const ve = !he && Hn && !Ft && vt !== "" && (String(vt).trim() === He || vt === On);
    !he && (ve || vt === "" || Sl) && ae(!1), Ce(null), ve && Ze("", it(Na));
  }), [wt, ke] = b.useState(!1), Fe = Re((he, ve) => {
    if (ut === he)
      return;
    ve.reason === h0 && lt && tn.length === 0 && !yl.current && ve.allowPropagation();
    const We = ve, mt = XT(We);
    if (l.onOpenChange?.(he, We), $t.current?.hasQuery && ve.reason === br === ve.isCanceled && ($t.current = null), !ve.isCanceled && (he && He !== null && Nt(ve.reason === br), !he && ne && (Ot ? (Ft || Ce(_n), _n === "" && ae(!1)) : Rt && (Ft || Ce(_n), Hn && qe({
      activeIndex: null
    }), (!Hn || Ft) && Ze("", it(Na, ve.event, void 0, {
      isItemPress: ve.reason === rb
    })))), he || ke(mt()), ml(he), !he && Hn && (ve.reason === Ru || ve.reason === g0) && (Ae(!0), pe(!1), xe === "onBlur"))) {
      const Mt = p === "none" ? vt : at;
      Ke.commit(Mt);
    }
  }), ct = Re((he, ve) => {
    if (f?.(he, ve), ve.isCanceled)
      return;
    dl(he), (p === "none" && At.current && ie || Ot && !Ie.state.inputInsidePopup) && Ze(Pe(he), it(ve.reason, ve.event));
  }), Xe = Re((he, ve) => {
    const We = cl(he), mt = tl.current ?? he;
    tl.current = null;
    const Mt = it(rb, mt), an = hc(We, "a")?.getAttribute("href");
    if (an) {
      an.startsWith("#") && Fe(!1, Mt);
      return;
    }
    if (Rt) {
      const Ht = Array.isArray(at) ? at : [], on = Ec(Ht, ve, G), Vn = on ? _O(Ht, ve, G) : [...Ht, ve];
      if (ct(Vn, Mt), Mt.isCanceled || !(ft.current ? ft.current.value.trim() !== "" : !1))
        return;
      if (Ie.state.inputInsidePopup) {
        Ze("", it(Na, Mt.event, void 0, {
          isItemPress: !0
        }));
        const Ka = $t.current;
        Ka && !on && (Ka.toggledValue = ve);
      } else
        Fe(!1, Mt);
    } else {
      if (ct(ve, Mt), Mt.isCanceled)
        return;
      Fe(!1, Mt);
    }
  }), gn = Re(() => {
    const he = Ke.inputRef.current?.form ?? Ie.state.inputElement?.form;
    he && typeof he.requestSubmit == "function" && he.requestSubmit();
  }), Jt = Re(() => {
    if (nn?.(!1), ae(!1), Ce(null), qe(p === "none" ? {
      activeIndex: null,
      selectedIndex: null
    } : {
      activeIndex: null
    }), Rt && ft.current && ft.current.value !== "" && !el.current && Ze("", it(Na)), Ot)
      if (Ie.state.inputInsidePopup)
        ft.current && ft.current.value !== "" && Ze("", it(Na));
      else {
        const he = Pe(at);
        ft.current && ft.current.value !== he && Ze(he, it(he === "" ? Na : Yn));
      }
  }), Un = b.useMemo(() => Ft && jn ? {
    current: hc(jn, '[role="dialog"]')
  } : At, [Ft, jn]), {
    mounted: cn,
    transitionStatus: ln,
    forceUnmount: qa
  } = S2({
    open: ut,
    ref: Un,
    preventUnmountOnClose: wt,
    setPreventUnmountOnClose: ke,
    onUnmount: Jt
  });
  b.useImperativeHandle(l.actionsRef, () => ({
    unmount: qa,
    close: () => Fe(!1, it(Gy))
  }), [qa, Fe]), Te(function() {
    const ve = Oe.current !== null && He === null;
    if (Oe.current = He, ut && (!ve || !lt) || (ut || (ma.current = null), p === "none"))
      return;
    const We = lt ? tn : Bt.current;
    qe({
      selectedIndex: sc(We, at, G, Rt)
    });
  }, [ut, He, at, p, Rt, lt, tn, G, qe]), Te(() => {
    Ne && (Bt.current = tn, St.current.length = tn.length);
  }, [Ne, tn]), Te(() => {
    !ut && $t.current?.hasQuery && ($t.current = null);
  }, [ut]), Te(() => {
    if (!ut && Ft && Un.current) {
      $t.current = null;
      return;
    }
    const he = lt || pt ? tn : Bt.current, ve = $t.current;
    if (ve) {
      const Ht = ut || Ft || Ie.state.positionerElement?.hidden === !1;
      if (ve.hasQuery) {
        const on = ft.current;
        !jt || String(vt).trim() === "" || Ft && jt !== "always" && (!on || Ol(on.ownerDocument) !== on) ? $t.current = null : Ht && // Individually rendered items register without re-running this effect, and their
        // registry has holes mid-reindex, so resolve their request immediately.
        (he[0] !== void 0 || !lt && !pt) && (Ie.set("activeIndex", 0), $t.current = null);
      } else if (String(vt).trim() === "" && ($t.current = null, Ht)) {
        const on = ve.selection;
        jt === "always" && !on && Ie.state.selectionMode === "none" && Ie.set("activeIndex", 0), queueMicrotask(() => {
          if (!Ie.state.open && (!Ie.state.inline || Un.current) || ft.current && ft.current.value.trim() !== "")
            return;
          const Vn = Ie.state.selectedValue, ba = Ie.state.selectionMode === "multiple";
          if (ba && Array.isArray(Vn) ? Vn.length > 0 : Ie.state.selectionMode !== "none" && Vn != null) {
            const Ln = lt || pt ? tn : Bt.current, ia = X0(Ln, ve.toggledValue, Ie.state.isItemEqualToValue);
            Ie.set("activeIndex", ia !== -1 ? ia : sc(Ln, Vn, Ie.state.isItemEqualToValue, ba));
          } else on ? Ie.set("activeIndex", null) : jt === "always" && Ie.set("activeIndex", 0);
        });
      }
    }
    if (!ut && !Ft)
      return;
    const We = Ie.state.activeIndex;
    if (We == null) {
      if (jt === "always" && he.length > 0) {
        Ie.set("activeIndex", 0);
        return;
      }
      Qe(void 0, -1, Yn);
      return;
    }
    if (We >= he.length) {
      Qe(void 0, -1, Yn), Ie.set("activeIndex", null);
      return;
    }
    const mt = he[We], Mt = Tn.current.value, an = Mt !== W2 && ci(mt, Mt, Ie.state.isItemEqualToValue);
    (Tn.current.index !== We || !an) && Qe(mt, We, Yn);
  }, [
    Xt,
    jt,
    Qe,
    pt,
    lt,
    tn,
    Ft,
    ut,
    Un,
    Ie,
    // Reruns the effect when the query changes without affecting the deps above, such as
    // clearing the input when no items are filtered out (individually rendered items).
    vt
  ]), Te(() => {
    if (p === "none") {
      oe(String(vt) !== "");
      return;
    }
    oe(Rt ? Array.isArray(at) && at.length > 0 : at != null);
  }, [oe, p, vt, at, Rt]), b.useEffect(() => {
    lt && jt && tn.length === 0 && qe({
      activeIndex: null
    });
  }, [lt, jt, tn.length, qe]);
  function Ji() {
    ut && _n !== "" && _n !== String(An) && !Sl && ae(!0);
  }
  function ta() {
    ut && He !== null && Nt(!1);
  }
  let Ga = !1;
  function $i() {
    !Ga && vt !== On && (Ga = !0, Ze(On, it(Yn)));
  }
  function qt() {
    p !== "none" && (O(nt), B(NO(at, ce.initialValue, G)), Ke.change(at), Ot && !dt && !Hn && $i());
  }
  function Nn() {
    Ot && !dt && !Hn && !ne && $i();
  }
  function ha() {
    p === "none" && (O(nt), B(vt !== ce.initialValue), Ke.change(vt));
  }
  oi(_n, Ji), oi(ut, ta), oi(at, qt), oi(On, Nn), oi(Ne, Nn), oi(vt, ha);
  const na = pA({
    open: Ft ? !0 : ut,
    onOpenChange: Fe,
    elements: {
      reference: Hn ? Yl : ea,
      floating: jn
    }
  }), Xn = R ? "grid" : "listbox", la = ut || Ft, il = la ? "true" : "false", pn = b.useMemo(() => {
    const he = ea?.tagName === "INPUT", ve = ea == null || he, We = ve || la, mt = ve ? {
      autoComplete: "off",
      spellCheck: "false",
      autoCorrect: "off",
      autoCapitalize: "none"
    } : {};
    return We && (mt.role = "combobox", mt["aria-expanded"] = il, mt["aria-haspopup"] = Xn, mt["aria-controls"] = la ? gi?.id : void 0, mt["aria-autocomplete"] = N ? "none" : te), {
      reference: mt,
      floating: {
        role: "presentation"
      }
    };
  }, [ea, la, il, Xn, gi?.id, te, N]), aa = I0(na, {
    enabled: !en && _,
    event: "mousedown-only",
    toggle: !1,
    // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
    // This avoids top-bottom flip flickers if the preferred position is "top" when first tapping.
    touchOpenDelay: Hn ? 0 : 100,
    reason: kC
  }), pa = x2(na, {
    enabled: !en && !Ft,
    outsidePressEvent: {
      mouse: "sloppy",
      // The visual viewport (affected by the mobile software keyboard) can be
      // somewhat small. The user may want to scroll the screen to see more of
      // the popup.
      touch: "intentional"
    },
    // Without a popup, let the Escape key bubble the event up to other popups' handlers.
    bubbles: Ft ? !0 : void 0,
    outsidePress(he) {
      const ve = cl(he);
      return !et(Yl, ve) && !et(Zt.current, ve) && !et(Wl.current, ve) && !et(ga, ve);
    }
  }), vn = yA(na, {
    enabled: !en,
    id: Le,
    listRef: St,
    activeIndex: Xt,
    selectedIndex: Mn,
    virtual: !0,
    loopFocus: q,
    allowEscape: q && !jt,
    focusItemOnOpen: ne || p === "none" && !jt ? !1 : "auto",
    focusItemOnHover: H,
    resetOnPointerLeave: !j,
    orientation: R ? "horizontal" : void 0,
    rtl: Ue === "rtl",
    disabledIndices: Vl,
    grid: R ? OO : void 0,
    onNavigate(he, ve) {
      !ve && !ut && !(Ft && he === null) || ln === "ending" || qe({
        activeIndex: he,
        type: G0(ve),
        event: ve?.nativeEvent
      });
    }
  }), va = b.useMemo(() => Ao(vn.reference, {
    onKeyDown(he) {
      R && Ie.state.activeIndex == null && (he.key === "ArrowLeft" || he.key === "ArrowRight") && he.preventBaseUIHandler();
    }
  }, pa.reference, aa.reference, pn.reference), [vn.reference, pa.reference, aa.reference, pn.reference, R, Ie]), pi = b.useMemo(() => Ao(E2, pa.floating), [pa.floating]), vi = b.useMemo(() => Ao(vn.floating, pn.floating), [vn.floating, pn.floating]), bn = b.useMemo(() => {
    const he = vn.item;
    return {
      // Combobox keeps focus on the input; item focus would incorrectly sync
      // list navigation state from DOM focus.
      props: he ? {
        ...he,
        onFocus: void 0
      } : un,
      id: Le,
      selectionMode: p,
      disabled: en,
      readOnly: N,
      isItemEqualToValue: G
    };
  }, [vn.item, Le, p, en, N, G]);
  Ie.useContextCallback("setOpen", Fe), Ie.useContextCallback("setInputValue", Ze), Ie.useContextCallback("setSelectedValue", ct), Ie.useContextCallback("setIndices", qe), Ie.useContextCallback("handleSelection", Xe), Ie.useContextCallback("forceMount", Be), Ie.useContextCallback("requestSubmit", gn), Ie.useContextCallback("onOpenChangeComplete", r), AO(() => {
    Ie.update({
      inline: k,
      popupProps: pi,
      listProps: vi,
      inputProps: va,
      triggerProps: fe,
      itemRoot: bn
    });
  });
  const In = {
    id: Le,
    selectedValue: at,
    open: ut,
    mounted: cn,
    transitionStatus: ln,
    items: Ye,
    inline: k,
    popupProps: pi,
    listProps: vi,
    inputProps: va,
    triggerProps: fe,
    itemRoot: bn,
    openMethod: W,
    selectionMode: p,
    name: nt,
    form: T,
    disabled: en,
    readOnly: N,
    required: E,
    grid: R,
    virtualized: le,
    openOnInputClick: _,
    itemToStringLabel: Me,
    modal: P,
    autoHighlight: jt,
    isItemEqualToValue: G,
    submitOnItemClick: ze,
    hasInputValue: dt
  };
  Te(() => {
    Ie.update({
      ...In,
      inputOwnsFormValue: p === "none" && (k || !Ie.state.inputInsidePopup)
    });
  }, [Ie, ...Object.values(In)]);
  const Ya = da(M, Ke.inputRef), ka = b.useMemo(() => ({
    query: _n,
    hasItems: lt,
    filteredItems: Gl,
    flatFilteredValues: tn
  }), [_n, lt, Gl, tn]), bt = b.useMemo(() => Array.isArray(wn) ? "" : yu(wn, Z), [wn, Z]), yn = Rt && Array.isArray(at) && at.length > 0, ol = Rt || p === "none" && hi ? void 0 : nt, gl = b.useMemo(() => !Rt || !Array.isArray(at) || !nt ? null : at.map((he) => {
    const ve = yu(he, Z);
    return /* @__PURE__ */ w.jsx("input", {
      type: "hidden",
      form: T,
      name: nt,
      value: ve,
      disabled: en
    }, ve);
  }), [Rt, at, T, nt, Z, en]), Xa = /* @__PURE__ */ w.jsxs(b.Fragment, {
    children: [l.children, /* @__PURE__ */ w.jsx("input", {
      ...Ke.getValidationProps(en, {
        // Move focus when the hidden input is focused.
        onFocus() {
          if (Hn) {
            Yl?.focus();
            return;
          }
          (ft.current || Yl)?.focus();
        },
        // Handle browser autofill.
        onChange(he) {
          if (he.nativeEvent.defaultPrevented || en || N)
            return;
          const ve = he.currentTarget.value, We = ve.toLowerCase(), mt = it(Yn, he.nativeEvent), Mt = () => Bt.current.findIndex((Ht) => yu(Ht, Z).toLowerCase() === We || Pe(Ht).toLowerCase() === We);
          function an() {
            if (Rt)
              return;
            if (p === "none") {
              Ze(ve, mt);
              return;
            }
            let Ht = Mt();
            Ht === -1 && (Ht = Bt.current.findIndex((Vn, ba) => {
              const Ka = Ct.current[ba];
              return Ka != null && Ka.toLowerCase() === We;
            }));
            const on = Ht === -1 ? void 0 : Bt.current[Ht];
            on != null && ct?.(on, mt);
          }
          Ot && (Be(), Ne && Mt() === -1 && Ie.set("forceMounted", !0)), queueMicrotask(an);
        }
      }),
      id: Le && ol == null ? `${Le}-hidden-input` : void 0,
      form: T,
      name: ol,
      autoComplete: De,
      disabled: en,
      required: E && !yn,
      readOnly: N,
      value: bt,
      ref: Ya,
      style: ol ? N0 : M0,
      tabIndex: -1,
      "aria-hidden": !0,
      suppressHydrationWarning: !0
    }), gl]
  });
  return /* @__PURE__ */ w.jsx(Y2.Provider, {
    value: Ie,
    children: /* @__PURE__ */ w.jsx(k2.Provider, {
      value: na,
      children: /* @__PURE__ */ w.jsx(K2.Provider, {
        value: lt,
        children: /* @__PURE__ */ w.jsx(X2.Provider, {
          value: ka,
          children: /* @__PURE__ */ w.jsx(P2.Provider, {
            value: vt,
            children: Xa
          })
        })
      })
    })
  });
}
const FO = "data-popup-side", JO = "data-list-empty", e1 = {
  ...oT,
  ...Kc,
  popupSide: (l) => l ? {
    [FO]: l
  } : null,
  listEmpty: (l) => l ? {
    [JO]: ""
  } : null
};
function Zc(l, i, r) {
  const {
    setFocused: s,
    focusOwnerRef: c
  } = mi(), f = Re((m) => {
    (m ? !l : c.current === f) && (c.current = m && f, s(m));
  });
  return Te(() => {
    const m = i.current;
    return m?.getRootNode()?.activeElement === m && f(!0), () => f(!1);
  }, [l, i, f]), f;
}
const lc = 5;
function $O(l, i) {
  const r = WO(i);
  return l.clientX >= r.left - lc && l.clientX <= r.right + lc && l.clientY >= r.top - lc && l.clientY <= r.bottom + lc;
}
function WO(l) {
  const i = l.getBoundingClientRect(), r = mn(l);
  if (Jy)
    return i;
  const s = r.getComputedStyle(l, "::before"), c = r.getComputedStyle(l, "::after");
  if (!(s.content !== "none" || c.content !== "none"))
    return i;
  const m = parseFloat(s.width) || 0, v = parseFloat(s.height) || 0, y = parseFloat(c.width) || 0, h = parseFloat(c.height) || 0, p = Math.max(i.width, m, y), g = Math.max(i.height, v, h), x = p - i.width, T = g - i.height;
  return {
    left: i.left - x / 2,
    right: i.right + x / 2,
    top: i.top - T / 2,
    bottom: i.bottom + T / 2
  };
}
function ew(l, i) {
  return l ?? i;
}
function t1(l) {
  const i = l.useState("mounted"), r = l.useState("popupSide"), s = l.useState("positionerElement");
  return i && s ? r : null;
}
function Fc() {
  return zu().filteredItems.length === 0;
}
function tw(l) {
  return l === "rtl" ? ["ArrowRight", "ArrowLeft"] : ["ArrowLeft", "ArrowRight"];
}
function n1(l, i, r) {
  const s = l.context.listRef.current[i];
  s && (l.context.selectionEventRef.current = r, s.click(), l.context.selectionEventRef.current = null);
}
const nw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    nativeButton: f = !0,
    disabled: m = !1,
    id: v,
    style: y,
    ...h
  } = i, {
    state: p,
    disabled: g,
    setTouched: x,
    validationMode: T,
    validation: A
  } = mi(), {
    labelId: N
  } = Or(), E = Bl(), M = E.useState("selectionMode"), R = E.useState("disabled"), I = E.useState("readOnly"), C = E.useState("required"), z = E.useState("positionerElement"), V = E.useState("listElement"), _ = E.useState("popupId"), U = E.useState("triggerProps"), j = E.useState("inputInsidePopup"), H = E.useState("id"), q = E.useState("labelId"), $ = E.useState("open"), Z = E.useState("selectedValue"), G = E.useState("activeIndex"), le = E.useState("selectedIndex"), k = E.useState("hasSelectedValue"), ie = Xc(), P = Y0(), J = _a(), te = g || R || m, De = Fc(), ge = t1(E), ze = b.useRef(null), O = Zc(te, ze);
  Pc({
    id: j ? v : void 0
  });
  const B = j ? v ?? H : v, ce = ew(N, q);
  let oe;
  $ && j ? oe = _ ?? J2(H) : $ && (oe = V?.id);
  const ye = b.useRef("");
  function de(be) {
    ye.current = be.pointerType;
  }
  const {
    reference: Ae
  } = xA(ie, {
    // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
    // gated on `readOnly`.
    enabled: !$ && !I && !R && M === "single",
    listRef: E.context.labelsRef,
    activeIndex: G,
    selectedIndex: le,
    onMatch(be) {
      const Ne = E.context.valuesRef.current[be];
      Ne !== void 0 && E.context.setSelectedValue(Ne, it(Yn));
    }
  }), {
    reference: pe
  } = I0(ie, {
    enabled: !R,
    event: "mousedown"
  }), {
    buttonRef: xe,
    getButtonProps: Ke
  } = Ua({
    native: f,
    disabled: te
  }), Ue = {
    ...p,
    readOnly: I,
    open: $,
    disabled: te,
    popupSide: ge,
    listEmpty: De,
    placeholder: M === "none" ? !1 : !k
  }, Le = Re((be) => {
    E.set("triggerElement", be);
  });
  return Tt("button", i, {
    ref: [r, xe, ze, Le],
    state: Ue,
    props: [U, pe, Ae, {
      id: B,
      tabIndex: j ? 0 : -1,
      role: j ? "combobox" : void 0,
      "aria-expanded": $,
      "aria-haspopup": j ? "dialog" : "listbox",
      "aria-controls": oe,
      "aria-required": j && C || void 0,
      // Only valid alongside the `combobox` role; without it the trigger is a plain button, and
      // the `Combobox.Input` outside the popup already carries `aria-readonly`.
      "aria-readonly": j && I || void 0,
      "aria-labelledby": ce,
      onPointerDown: de,
      onPointerEnter: de,
      onFocus() {
        O(!0), !te && J.start(0, E.context.forceMount);
      },
      onBlur(be) {
        if (!et(z, be.relatedTarget) && (x(!0), O(!1), T === "onBlur")) {
          const Ne = M === "none" ? P : Z;
          A.commit(Ne);
        }
      },
      onMouseDown(be) {
        if (te || (j || ie.set("domReferenceElement", be.currentTarget), E.context.forceMount(), ye.current !== "touch" && (E.context.inputRef.current?.focus(), j || be.preventDefault()), $))
          return;
        const Ne = Qt(be.currentTarget);
        function Ee(Ye) {
          const re = E.state.triggerElement;
          if (!re)
            return;
          const Me = cl(Ye), je = E.state.positionerElement, Pe = E.state.listElement;
          et(re, Me) || et(je, Me) || et(Pe, Me) || $O(Ye, re) || E.context.setOpen(!1, it(PC, Ye));
        }
        j && Ne.addEventListener("mouseup", Ee, {
          once: !0
        });
      },
      onKeyDown(be) {
        (be.key === "ArrowDown" || be.key === "ArrowUp") && (zn(be), E.context.setOpen(!0, it(Xm, be.nativeEvent)), E.context.inputRef.current?.focus());
      }
    }, A.getValidationProps(te, h), Ke],
    stateAttributesMapping: e1
  });
}), lw = /* @__PURE__ */ b.createContext(void 0);
function aw() {
  return b.useContext(lw);
}
const l1 = /* @__PURE__ */ b.createContext(void 0);
function Z0(l) {
  const i = b.useContext(l1);
  if (i === void 0 && !l)
    throw new Error(Rn(21));
  return i;
}
const a1 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const s = Bl(), {
    buttonRef: c,
    getButtonProps: f
  } = Ua({
    native: !1
  }), m = da(r, c);
  function v(h) {
    s.context.setOpen(!1, it(qy, h.nativeEvent, h.currentTarget));
  }
  const y = f({
    onClick: v
  });
  return /* @__PURE__ */ w.jsx("span", {
    ref: m,
    ...y,
    "aria-label": "Dismiss",
    tabIndex: void 0,
    style: N0
  });
}), iw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    disabled: f = !1,
    id: m,
    style: v,
    ...y
  } = i, {
    state: h,
    disabled: p,
    setTouched: g,
    validationMode: x,
    validation: T
  } = mi(), {
    labelId: A
  } = Or(), N = aw(), M = !!Z0(!0), R = Bl(), I = Y0(), C = Qc(), z = R.useState("required"), V = R.useState("disabled"), _ = R.useState("readOnly"), U = R.useState("name"), j = R.useState("form"), H = R.useState("selectionMode"), q = R.useState("autoHighlight"), $ = R.useState("inputProps"), Z = R.useState("triggerProps"), G = R.useState("open"), le = R.useState("mounted"), k = R.useState("selectedValue"), ie = R.useState("id"), P = R.useState("inline"), J = R.useState("modal"), te = !!q, De = t1(R), ge = p || V || f, ze = Fc(), O = Zc(ge, R.context.inputRef), B = M || P, ce = !B || J, oe = wl(m ?? (B ? void 0 : ie)), ye = M ? Q2 : h, [de, Ae] = b.useState(null), pe = b.useRef(!1), xe = b.useRef(null);
  Te(() => {
    G || (xe.current = null);
  }, [G]);
  const Ke = H === "none" && !M, Ue = Re((re) => {
    const Me = M || R.state.inline;
    Me && !R.state.hasInputValue && R.context.setInputValue("", it(Yn)), R.update({
      inputElement: re,
      inputInsidePopup: Me,
      inputOwnsFormValue: Ke
    });
  }), Le = M ? y : T.getValidationProps(ge, y);
  function Se(re) {
    R.context.setIndices({
      activeIndex: null,
      selectedIndex: null,
      type: G0(re),
      event: re
    });
  }
  const be = {
    ...ye,
    open: G,
    disabled: ge,
    readOnly: _,
    popupSide: De,
    listEmpty: ze
  };
  function Ne(re) {
    if (!N)
      return;
    let Me;
    const je = N.chipsRef.current.length, [Pe] = tw(C);
    return re.key === Pe && (re.currentTarget.selectionStart ?? 0) === 0 && k.length > 0 && (re.preventDefault(), Me = je > 0 ? je - 1 : void 0), Me;
  }
  const Ee = Tt("input", i, {
    state: be,
    ref: [r, R.context.inputRef, Ue],
    props: [$, Z, {
      value: de ?? I,
      "aria-readonly": _ || void 0,
      "aria-required": z || void 0,
      "aria-labelledby": A,
      disabled: ge,
      readOnly: _,
      required: H === "none" ? z : void 0,
      form: j,
      ...Ke && U && {
        name: U
      },
      id: oe,
      onFocus() {
        if (O(!0), !P)
          return;
        const re = xe.current;
        xe.current = null, !(re == null || // `valuesRef` can be sparse, so guard against restoring a removed slot.
        !Object.hasOwn(R.context.valuesRef.current, re)) && R.context.setIndices({
          activeIndex: re
        });
      },
      onBlur() {
        g(!0), O(!1);
        const re = R.state.activeIndex;
        if (P && re !== null && q !== "always" && (xe.current = re, R.context.setIndices({
          activeIndex: null
        })), x === "onBlur") {
          const Me = H === "none" ? I : k;
          T.commit(Me);
        }
      },
      onCompositionStart(re) {
        gc || (pe.current = !0, Ae(re.currentTarget.value));
      },
      onCompositionEnd(re) {
        pe.current = !1;
        const Me = re.currentTarget.value;
        Ae(null), R.context.setInputValue(Me, it(br, re.nativeEvent));
      },
      onChange(re) {
        const Me = re.nativeEvent, je = Me.inputType, Pe = !je || je === "insertReplacementText", ne = pe.current || !Pe;
        function ae(St) {
          _ || ge || !St || !ne || (R.context.setOpen(!0, it(br, Me)), te || Se(Me));
        }
        if (pe.current) {
          const St = re.currentTarget.value;
          Ae(St), St === "" && !R.state.openOnInputClick && !R.state.inputInsidePopup && R.context.setOpen(!1, it(Na, Me));
          const Ct = St.trim(), At = te && Ct !== "";
          ae(Ct), G && R.state.activeIndex !== null && !At && Se(Me);
          return;
        }
        const He = it(br, Me);
        if (R.context.setInputValue(re.currentTarget.value, He), He.isCanceled)
          return;
        const Ce = re.currentTarget.value === "", Oe = it(Na, Me);
        Ce && !R.state.inputInsidePopup && (H === "single" && R.context.setSelectedValue(null, Oe), R.state.openOnInputClick || R.context.setOpen(!1, Oe)), ae(re.currentTarget.value.trim()), G && R.state.activeIndex !== null && !te && Se(Me);
      },
      onKeyDown(re) {
        if (re.ctrlKey || re.shiftKey || re.altKey || re.metaKey)
          return;
        if (ge || _) {
          _ && re.key === "Enter" && G && R.state.activeIndex !== null && zn(re);
          return;
        }
        const Me = re.currentTarget, je = Me.scrollWidth - Me.clientWidth, Pe = C === "rtl";
        if (re.key === "Home") {
          zn(re);
          const ae = pb && Pe ? Me.value.length : 0;
          Me.setSelectionRange(ae, ae), Me.scrollLeft = 0;
          return;
        }
        if (re.key === "End") {
          zn(re);
          const ae = pb && Pe ? 0 : Me.value.length;
          Me.setSelectionRange(ae, ae), Me.scrollLeft = Pe ? -je : je;
          return;
        }
        if (!le && re.key === "Escape") {
          const ae = H === "multiple" && Array.isArray(k) ? k.length === 0 : k === null, He = it(h0, re.nativeEvent), Ce = H === "multiple" ? [] : null;
          R.context.setInputValue("", He), R.context.setSelectedValue(Ce, He), !ae && !R.state.inline && !He.isPropagationAllowed && re.stopPropagation();
          return;
        }
        if (N && re.key === "Backspace" && Me.value === "" && Array.isArray(k) && k.length > 0) {
          const ae = N.chipsRef.current.length, He = ae > 0 ? ae - 1 : k.length - 1, Ce = k.filter((Oe, St) => St !== He);
          Se(re.nativeEvent), R.context.setSelectedValue(Ce, it(Yn, re.nativeEvent));
          return;
        }
        const ne = Ne(re);
        if (ne !== void 0 && N?.chipsRef.current[ne]?.focus(), re.which !== 229 && re.key === "Enter" && G) {
          const ae = R.state.activeIndex, He = re.nativeEvent;
          if (ae === null) {
            if (P)
              return;
            R.context.setOpen(!1, it(Yn, He));
            return;
          }
          zn(re), n1(R, ae, He);
        }
      }
    }, Le],
    stateAttributesMapping: e1
  }), Ye = M ? /* @__PURE__ */ w.jsx(F2.Provider, {
    value: Z2,
    children: Ee
  }) : Ee;
  return /* @__PURE__ */ w.jsxs(b.Fragment, {
    children: [G && ce && /* @__PURE__ */ w.jsx(a1, {
      ref: R.context.startDismissRef
    }), Ye]
  });
}), ow = {
  ...Qi,
  ...e2
}, rw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    disabled: f = !1,
    nativeButton: m = !0,
    keepMounted: v = !1,
    style: y,
    ...h
  } = i, {
    disabled: p
  } = mi(), g = Bl(), x = g.useState("selectionMode"), T = g.useState("disabled"), A = g.useState("readOnly"), N = g.useState("open"), E = g.useState("selectedValue"), M = g.useState("hasSelectionChips"), R = Y0();
  let I = !1;
  x === "none" ? I = R !== "" : x === "single" ? I = E != null : I = M;
  const C = p || T || f, {
    buttonRef: z,
    getButtonProps: V
  } = Ua({
    native: m,
    disabled: C
  }), {
    mounted: _,
    transitionStatus: U,
    setMounted: j
  } = Tr(I), H = {
    disabled: C,
    visible: I,
    open: N,
    transitionStatus: U
  };
  Zi({
    open: I,
    ref: g.context.clearRef,
    onComplete() {
      I || j(!1);
    }
  });
  const q = Tt("button", i, {
    state: H,
    ref: [r, z, g.context.clearRef],
    props: [{
      tabIndex: -1,
      children: "x",
      // Avoid stealing focus from the input.
      onMouseDown(Z) {
        Z.preventDefault();
      },
      onClick(Z) {
        if (C || A)
          return;
        const G = G0(Z);
        g.context.setInputValue("", it(ub, Z.nativeEvent)), x !== "none" ? (g.context.setSelectedValue(Array.isArray(E) ? [] : null, it(ub, Z.nativeEvent)), g.context.setIndices({
          activeIndex: null,
          selectedIndex: null,
          type: G,
          event: Z.nativeEvent
        })) : g.context.setIndices({
          activeIndex: null,
          type: G,
          event: Z.nativeEvent
        }), g.context.inputRef.current?.focus();
      }
    }, h, V],
    stateAttributesMapping: ow
  });
  return v || _ ? q : null;
}), i1 = /* @__PURE__ */ b.createContext(null);
function uw() {
  return b.useContext(i1);
}
function sw(l) {
  const {
    children: i,
    items: r
  } = l, s = b.useMemo(() => ({
    items: r
  }), [r]);
  return /* @__PURE__ */ w.jsx(i1.Provider, {
    value: s,
    children: i
  });
}
function o1(l) {
  const {
    children: i
  } = l, {
    filteredItems: r
  } = zu(), s = uw(), c = s ? s.items : r;
  return /* @__PURE__ */ w.jsx(b.Fragment, {
    children: c.map(i)
  });
}
const cw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  var s;
  const {
    render: c,
    className: f,
    style: m,
    children: v,
    ...y
  } = i, h = Bl(), p = Xc(), g = !!Z0(!0), {
    filteredItems: x,
    hasItems: T
  } = zu(), A = h.useState("selectionMode"), N = h.useState("grid"), E = h.useState("readOnly"), M = h.useState("listProps"), R = h.useState("virtualized"), I = h.useState("forceMounted"), C = A === "multiple", z = x.length === 0, V = Re((Z) => {
    h.set("positionerElement", Z);
  }), _ = Re((Z) => {
    h.set("listElement", Z);
  }), U = b.useMemo(() => typeof v == "function" ? s || (s = /* @__PURE__ */ w.jsx(o1, {
    children: v
  })) : v, [v]), j = {
    empty: z
  }, H = p.useState("floatingId"), q = Tt("div", i, {
    state: j,
    ref: [r, _, g ? null : V],
    props: [M, {
      children: U,
      tabIndex: -1,
      id: H,
      role: N ? "grid" : "listbox",
      "aria-multiselectable": C ? "true" : void 0,
      // On a grid the attribute describes cell editability, not selection, so it's left to the
      // combobox element in that mode.
      "aria-readonly": !N && E ? !0 : void 0,
      onKeyDown(Z) {
        if (!(h.state.disabled || h.state.readOnly) && Z.key === "Enter") {
          const G = h.state.activeIndex;
          if (G == null)
            return;
          zn(Z), n1(h, G, Z.nativeEvent);
        }
      }
    }, y]
  });
  if (R)
    return q;
  const $ = T && !I ? void 0 : h.context.labelsRef;
  return /* @__PURE__ */ w.jsx(wc, {
    elementsRef: h.context.listRef,
    labelsRef: $,
    children: q
  });
}), fw = "⁠", dw = 200;
function mw(l) {
  const i = l.ownerDocument.createTreeWalker(l, NodeFilter.SHOW_TEXT);
  let r = null;
  for (; i.nextNode(); ) {
    const s = i.currentNode;
    s.nodeValue !== "" && (r = s);
  }
  return r;
}
function gw(l = !0) {
  const i = _a(), r = b.useRef(null);
  return b.useEffect(() => {
    if (!l || Du)
      return;
    const s = r.current;
    if (s == null)
      return;
    const c = mw(s);
    if (c == null)
      return;
    const f = c.data, m = `${f}${fw}`;
    return c.nodeValue = m, i.start(dw, () => {
      c.nodeValue === m && (c.nodeValue = f);
    }), () => {
      i.clear(), c.nodeValue === m && (c.nodeValue = f);
    };
  }, [l, r, i]), r;
}
const r1 = /* @__PURE__ */ b.createContext(void 0);
function hw() {
  const l = b.useContext(r1);
  if (l === void 0)
    throw new Error(Rn(20));
  return l;
}
const pw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    keepMounted: s = !1,
    ...c
  } = i, f = Bl(), m = f.useState("mounted"), v = f.useState("forceMounted");
  return m || s || v ? /* @__PURE__ */ w.jsx(r1.Provider, {
    value: s,
    children: /* @__PURE__ */ w.jsx(b2, {
      ref: r,
      ...c
    })
  }) : null;
});
function vw(l) {
  const {
    nodeId: i,
    externalTree: r,
    rootContext: s
  } = l, c = s.useState("referenceElement"), f = s.useState("floatingElement"), m = s.useState("domReferenceElement"), v = s.useState("open"), y = s.useState("floatingId"), [h, p] = b.useState(null), g = b.useRef(null), x = Gc(r), T = b.useMemo(() => ({
    reference: c,
    floating: f,
    domReference: m
  }), [c, f, m]), A = eO({
    ...l,
    elements: {
      ...T,
      ...h && {
        reference: h
      }
    }
  }), N = b.useCallback((I) => {
    const C = kn(I) ? {
      getBoundingClientRect: () => I.getBoundingClientRect(),
      getClientRects: () => I.getClientRects(),
      contextElement: I
    } : I;
    p(C), A.refs.setReference(C);
  }, [A.refs]), E = b.useMemo(() => ({
    ...A.refs,
    setPositionReference: N,
    domReference: g
  }), [A.refs, N]), M = b.useMemo(() => ({
    ...A.elements,
    domReference: m
  }), [A.elements, m]), R = b.useMemo(() => ({
    ...A,
    dataRef: s.context.dataRef,
    open: v,
    onOpenChange: s.setOpen,
    events: s.context.events,
    floatingId: y,
    refs: E,
    elements: M,
    nodeId: i,
    rootStore: s
  }), [A, E, M, i, s, v, y]);
  return Te(() => {
    m && (g.current = m);
  }, [m]), Te(() => {
    s.context.dataRef.current.floatingContext = R;
    const I = x?.nodesRef.current.find((C) => C.id === i);
    I && (I.context = R);
  }), b.useMemo(() => ({
    ...A,
    context: R,
    refs: E,
    elements: M,
    rootStore: s
  }), [A, E, M, R, s]);
}
const bw = (l) => ({
  name: "arrow",
  options: l,
  async fn(i) {
    const {
      x: r,
      y: s,
      placement: c,
      rects: f,
      platform: m,
      elements: v,
      middlewareData: y
    } = i, {
      element: h,
      padding: p = 0
    } = Pi(l, i) || {};
    if (h == null)
      return {};
    const g = l2(p), x = {
      x: r,
      y: s
    }, T = _0(c), A = z0(T), N = await m.getDimensions(h), E = T === "y", M = E ? "top" : "left", R = E ? "bottom" : "right", I = E ? "clientHeight" : "clientWidth", C = f.reference[A] + f.reference[T] - x[T] - f.floating[A], z = x[T] - f.reference[T], V = v.floating[I] || f.floating[A], _ = C / 2 - z / 2, U = V / 2 - N[A] / 2 - 1, j = Math.min(g[M], U), H = Math.min(g[R], U), q = j, $ = V - N[A] - H, Z = V / 2 - N[A] / 2 + _, G = n2(q, Z, $), le = !y.arrow && ja(c) != null && Z !== G && f.reference[A] / 2 - (Z < q ? j : H) - N[A] / 2 < 0, k = le ? Z < q ? Z - q : Z - $ : 0;
    return {
      [T]: x[T] + k,
      data: {
        [T]: G,
        centerOffset: Z - G - k,
        ...le && {
          alignmentOffset: k
        }
      },
      reset: le
    };
  }
}), yw = (l, i) => {
  const {
    name: r,
    fn: s
  } = bw(l);
  return {
    name: r,
    fn: s,
    options: [l, i]
  };
}, xw = {
  name: "hide",
  async fn(l) {
    const {
      width: i,
      height: r,
      x: s,
      y: c
    } = l.rects.reference, f = i === 0 && r === 0 && s === 0 && c === 0, m = await l.platform.detectOverflow(l, {
      elementContext: "reference"
    });
    return {
      data: {
        referenceHidden: m.top - r >= 0 || m.right - i >= 0 || m.bottom - r >= 0 || m.left - i >= 0 || f
      }
    };
  }
}, Sw = {
  sideX: "left",
  sideY: "top"
}, Ew = "--available-width", Cw = "--available-height", Rw = "--anchor-width", Tw = "--anchor-height", Aw = "--transform-origin", Fb = Ew, Jb = Cw;
function u1(l, i, r) {
  const s = l === "inline-start" || l === "inline-end";
  return {
    top: "top",
    right: s ? r ? "inline-start" : "inline-end" : "right",
    bottom: "bottom",
    left: s ? r ? "inline-end" : "inline-start" : "left"
  }[i];
}
function $b(l, i, r) {
  const {
    rects: s,
    placement: c
  } = l;
  return {
    side: u1(i, Ll(c), r),
    align: ja(c) || "center",
    anchor: {
      width: s.reference.width,
      height: s.reference.height
    },
    positioner: {
      width: s.floating.width,
      height: s.floating.height
    }
  };
}
function Ow(l) {
  return ww(l, vw);
}
function ww(l, i) {
  const {
    // Public parameters
    anchor: r,
    positionMethod: s = "absolute",
    side: c = "bottom",
    sideOffset: f = 0,
    align: m = "center",
    alignOffset: v = 0,
    collisionBoundary: y,
    collisionPadding: h = 5,
    sticky: p = !1,
    arrowPadding: g = 5,
    disableAnchorTracking: x = !1,
    inline: T,
    // Private parameters
    keepMounted: A = !1,
    floatingRootContext: N,
    mounted: E,
    collisionAvoidance: M,
    shift: R,
    nodeId: I,
    adaptiveOrigin: C,
    lazyFlip: z = !1,
    externalTree: V
  } = l, _ = M.side || "flip", U = M.align || "flip", j = M.fallbackAxisSide || "end", H = R?.crossAxis ?? !1, q = R?.rootBoundary, $ = typeof r == "function" ? r : void 0, Z = Re($), G = $ ? Z : r, le = sl(r), k = sl(E), P = Qc() === "rtl", [J, te] = b.useState(null);
  !E && J !== null && te(null);
  const De = z === "placement", ge = J ? Ll(J) : null, ze = J && De ? ja(J) || "center" : null, O = ge || {
    top: "top",
    right: "right",
    bottom: "bottom",
    left: "left",
    "inline-end": P ? "left" : "right",
    "inline-start": P ? "right" : "left"
  }[c], B = ze || m, ce = B === "center" ? O : `${O}-${B}`;
  let oe = h;
  typeof oe == "number" ? oe = {
    top: oe,
    right: oe,
    bottom: oe,
    left: oe
  } : oe && (oe = {
    top: oe.top || 0,
    right: oe.right || 0,
    bottom: oe.bottom || 0,
    left: oe.left || 0
  });
  const ye = 1, de = c === "bottom" ? ye : 0, Ae = c === "top" ? ye : 0, pe = c === "right" ? ye : 0, xe = c === "left" ? ye : 0, Ke = {
    boundary: y === "clipping-ancestors" ? "clippingAncestors" : y,
    padding: oe
  }, Ue = b.useRef(null), Le = sl(f), Se = sl(v), be = typeof f != "function" ? f : 0, Ne = typeof v != "function" ? v : 0, Ee = [];
  T && Ee.push(T), Ee.push(tO((nt) => {
    const Rt = $b(nt, c, P), Ot = typeof Le.current == "function" ? Le.current(Rt) : Le.current, dt = typeof Se.current == "function" ? Se.current(Rt) : Se.current;
    return {
      mainAxis: Ot,
      crossAxis: dt,
      alignmentAxis: dt
    };
  }, [be, Ne, P, c]));
  const Ye = U === "none" && _ !== "shift", re = !Ye && (p || H || _ === "shift"), Me = _ === "none" ? null : aO({
    ...Ke,
    // Ensure the popup flips if it's been limited by its --available-height and it resizes.
    // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
    padding: {
      top: oe.top + ye + de,
      right: oe.right + ye + xe,
      bottom: oe.bottom + ye + Ae,
      left: oe.left + ye + pe
    },
    mainAxis: !H && _ === "flip",
    crossAxis: U === "flip" ? "alignment" : !1,
    fallbackAxisSideDirection: j
  }), je = Ye ? null : nO({
    ...Ke,
    // Use the Layout Viewport to avoid shifting around when pinch-zooming.
    rootBoundary: q,
    mainAxis: U !== "none",
    crossAxis: re,
    limiter: p || H ? void 0 : lO((nt) => {
      if (!Ue.current)
        return {};
      const {
        width: Rt,
        height: Ot
      } = Ue.current.getBoundingClientRect(), dt = $l(Ll(nt.placement)), lt = dt === "y" ? Rt : Ot, pt = dt === "y" ? oe.left + oe.right : oe.top + oe.bottom;
      return {
        offset: lt / 2 + pt / 2
      };
    })
  }, [Ke, p, H, q, oe, U]);
  _ === "shift" || U === "shift" || B === "center" ? Ee.push(je, Me) : Ee.push(Me, je), Ee.push(iO({
    ...Ke,
    apply({
      elements: {
        floating: nt
      },
      availableWidth: Rt,
      availableHeight: Ot,
      rects: dt
    }) {
      if (!k.current)
        return;
      const lt = nt.style;
      lt.setProperty(Fb, `${Rt}px`), lt.setProperty(Jb, `${Ot}px`);
      const pt = mn(nt).devicePixelRatio || 1, {
        x: jt,
        y: at,
        width: dl,
        height: sn
      } = dt.reference, An = (Math.round((jt + dl) * pt) - Math.round(jt * pt)) / pt, vt = (Math.round((at + sn) * pt) - Math.round(at * pt)) / pt;
      lt.setProperty(Rw, `${An}px`), lt.setProperty(Tw, `${vt}px`);
    }
  }), yw((nt) => ({
    // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
    // we'll create a fake element.
    element: Ue.current || Qt(nt.elements.floating).createElement("div"),
    // No padding for the fake arrow: it would displace aligned popups on narrow anchors.
    padding: Ue.current ? g : 0
  }), [g]), {
    name: "transformOrigin",
    fn(nt) {
      const {
        elements: {
          floating: Rt
        },
        middlewareData: Ot,
        placement: dt,
        platform: lt,
        rects: pt,
        y: jt
      } = nt, at = Ll(dt), dl = ja(dt), sn = $l(at) === "y", An = Ue.current, vt = typeof f == "function" ? f($b(nt, c, P)) : f;
      let nl;
      if (!An && dl && Math.abs(sn ? Ot.shift?.x || 0 : Ot.shift?.y || 0) <= 1)
        nl = dl === "start" === (sn && lt.isRTL?.(Rt) === !0) ? "100%" : "0%";
      else {
        const ml = sn ? Ot.arrow?.x || 0 : Ot.arrow?.y || 0, Nl = sn ? An?.clientWidth || 0 : An?.clientHeight || 0;
        nl = `${ml + Nl / 2}px`;
      }
      let ut = at === "top" || at === "left" ? `calc(100% + ${vt}px)` : `${-vt}px`;
      return re && sn && Math.abs(Ot.shift?.y || 0) > vt && (ut = `${pt.reference.y + pt.reference.height / 2 - jt}px`), Rt.style.setProperty(Aw, sn ? `${nl} ${ut}` : `${ut} ${nl}`), {};
    }
  }, xw, C), Te(() => {
    !E && N && N.update({
      referenceElement: null,
      floatingElement: null,
      domReferenceElement: null,
      positionReference: null
    });
  }, [E, N]);
  const Pe = b.useMemo(() => ({
    ancestorScroll: !x,
    elementResize: !x && typeof ResizeObserver < "u",
    layoutShift: !x && typeof IntersectionObserver < "u"
  }), [x]), {
    refs: ne,
    elements: ae,
    x: He,
    y: Ce,
    middlewareData: Oe,
    update: St,
    placement: Ct,
    context: At,
    isPositioned: ft,
    floatingStyles: Wn
  } = i({
    rootContext: N,
    open: A ? E : void 0,
    placement: ce,
    middleware: Ee,
    strategy: s,
    whileElementsMounted: A ? void 0 : (...nt) => kb(...nt, Pe),
    nodeId: I,
    externalTree: V
  }), {
    sideX: ql,
    sideY: yl
  } = Oe.adaptiveOrigin || Sw, el = ft ? s : "fixed", Wl = b.useMemo(() => {
    let nt;
    return ft ? C ? nt = {
      position: el,
      [ql]: He,
      [yl]: Ce
    } : nt = {
      ...Wn,
      position: el
    } : nt = {
      position: el,
      top: 0,
      left: 0
    }, nt[Fb] = "100vw", nt[Jb] = "100vh", ft || (nt.opacity = 0), nt;
  }, [C, el, ql, He, yl, Ce, Wn, ft]), Zt = b.useRef(null);
  Te(() => {
    if (!E)
      return;
    const nt = le.current, Rt = typeof nt == "function" ? nt() : nt, dt = (Wb(Rt) ? Rt.current : Rt) || null || null;
    dt !== Zt.current && (ne.setPositionReference(dt), Zt.current = dt);
  }, [E, ne, G, le]), b.useEffect(() => {
    if (!E)
      return;
    const nt = le.current;
    typeof nt != "function" && Wb(nt) && nt.current !== Zt.current && (ne.setPositionReference(nt.current), Zt.current = nt.current);
  }, [E, ne, G, le]), b.useEffect(() => {
    if (A && E && ae.reference && ae.floating)
      return kb(ae.reference, ae.floating, St, Pe);
  }, [A, E, ae, St, Pe]);
  const tl = Ll(Ct), Tn = u1(c, tl, P), $t = ja(Ct) || "center", Bt = !!Oe.hide?.referenceHidden;
  Te(() => {
    z && E && ft && (tl !== O || De && $t !== B) && te(Ct);
  }, [z, De, E, ft, Ct, tl, $t, O, B]);
  const ma = b.useMemo(() => ({
    position: "absolute",
    top: Oe.arrow?.y,
    left: Oe.arrow?.x
  }), [Oe.arrow]), en = Oe.arrow?.centerOffset !== 0;
  return b.useMemo(() => ({
    positionerStyles: Wl,
    arrowStyles: ma,
    arrowRef: Ue,
    arrowUncentered: en,
    side: Tn,
    align: $t,
    physicalSide: tl,
    anchorHidden: Bt,
    refs: ne,
    context: At,
    isPositioned: ft,
    update: St
  }), [Wl, ma, Ue, en, Tn, $t, tl, Bt, ne, At, ft, St]);
}
function Wb(l) {
  return l != null && "current" in l;
}
function s1(l) {
  return l === "starting" ? OT : un;
}
function Mw(l, i, {
  styles: r,
  transitionStatus: s,
  props: c,
  refs: f,
  hidden: m,
  inert: v = !1
}) {
  const y = {
    ...r
  };
  return v && (y.pointerEvents = "none"), Tt("div", l, {
    state: i,
    ref: f,
    props: [{
      role: "presentation",
      hidden: m,
      style: y
    }, s1(s), c],
    stateAttributesMapping: Vc
  });
}
const Nw = 20;
function Dw(l, i, r, s) {
  const [c, f] = b.useState(!1);
  Te(() => {
    if (!l || !i || r == null) {
      f(!1);
      return;
    }
    const m = Qt(r).documentElement.clientWidth, v = r.offsetWidth;
    f(m > 0 && v > 0 && v >= m - Nw);
  }, [l, i, r]), $y(l && (!i || c), s);
}
const zw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    anchor: f,
    // `useAnchorPositioning` applies the same defaults to the undefined values; the names
    // remain destructured to exclude the props from `elementProps`.
    positionMethod: m,
    side: v,
    align: y,
    sideOffset: h,
    alignOffset: p,
    collisionBoundary: g = "clipping-ancestors",
    collisionPadding: x,
    arrowPadding: T,
    sticky: A,
    disableAnchorTracking: N = !1,
    collisionAvoidance: E = wT,
    style: M,
    ...R
  } = i, I = Bl(), C = Xc(), z = hw(), V = I.useState("modal"), _ = I.useState("open"), U = I.useState("mounted"), j = I.useState("openMethod"), H = I.useState("positionerElement"), q = I.useState("triggerElement"), $ = I.useState("inputElement"), Z = I.useState("inputGroupElement"), G = I.useState("inputInsidePopup"), le = I.useState("transitionStatus"), k = Fc(), P = Ow({
    anchor: f ?? (G ? q : Z ?? $),
    floatingRootContext: C,
    positionMethod: m,
    mounted: U,
    side: v,
    sideOffset: h,
    align: y,
    alignOffset: p,
    arrowPadding: T,
    collisionBoundary: g,
    collisionPadding: x,
    sticky: A,
    disableAnchorTracking: N,
    keepMounted: z,
    collisionAvoidance: E,
    lazyFlip: !0
  });
  Dw(_ && V, j === "touch", H, q);
  const J = {
    open: _,
    side: P.side,
    align: P.align,
    anchorHidden: P.anchorHidden,
    empty: k
  };
  Te(() => {
    I.set("popupSide", P.side);
  }, [I, P.side]);
  const te = Re((ge) => {
    I.set("positionerElement", ge);
  }), De = Mw(i, J, {
    styles: P.positionerStyles,
    transitionStatus: le,
    props: R,
    refs: [r, te],
    hidden: !U,
    inert: !_
  });
  return /* @__PURE__ */ w.jsxs(l1.Provider, {
    value: P,
    children: [U && V && /* @__PURE__ */ w.jsx(q2, {
      inert: q0(!_),
      cutout: Z ?? $ ?? q
    }), De]
  });
}), _w = {
  ...Vc,
  ...Qi
}, jw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    initialFocus: m,
    finalFocus: v,
    ...y
  } = i, h = Bl(), p = Z0(), g = Xc(), x = h.useState("mounted"), T = h.useState("open"), A = h.useState("openMethod"), N = h.useState("popupProps"), E = h.useState("transitionStatus"), M = h.useState("inputInsidePopup"), R = h.useState("inputElement"), I = h.useState("modal"), C = h.useState("id"), z = Fc(), V = y.id ?? (M ? J2(C) : void 0);
  Te(() => (h.set("popupId", h.context.popupRef.current?.id || V), () => {
    h.set("popupId", void 0);
  }), [h, V]), Zi({
    open: T,
    ref: h.context.popupRef,
    onComplete() {
      T && h.context.onOpenChangeComplete(!0);
    }
  });
  const _ = {
    open: T,
    side: p.side,
    align: p.align,
    anchorHidden: p.anchorHidden,
    transitionStatus: E,
    empty: z
  }, U = Tt("div", i, {
    state: _,
    ref: [r, h.context.popupRef],
    props: [N, {
      id: V,
      role: M ? "dialog" : "presentation",
      onFocus(Z) {
        const G = cl(Z.nativeEvent);
        A !== "touch" && (et(h.state.listElement, G) || G === Z.currentTarget) && h.context.inputRef.current?.focus();
      }
    }, s1(E), y],
    stateAttributesMapping: _w
  }), H = m === void 0 ? M ? (Z) => Z === "touch" ? h.context.popupRef.current : R : !1 : m;
  let q;
  v != null ? q = v : q = M ? void 0 : !1;
  const $ = !M || I;
  return /* @__PURE__ */ w.jsx(y2, {
    context: g,
    disabled: !x,
    modal: $,
    openInteractionType: A,
    initialFocus: H,
    returnFocus: q,
    getInsideElements: () => [h.context.startDismissRef.current, h.context.endDismissRef.current],
    children: /* @__PURE__ */ w.jsxs(b.Fragment, {
      children: [U, $ && /* @__PURE__ */ w.jsx(a1, {
        ref: h.context.endDismissRef
      })]
    })
  });
}), c1 = /* @__PURE__ */ b.createContext(void 0);
function Hw() {
  const l = b.useContext(c1);
  if (l === void 0)
    throw new Error(Rn(18));
  return l;
}
const Uw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    items: m,
    ...v
  } = i, h = Bl().useState("grid"), [p, g] = b.useState(), x = b.useMemo(() => ({
    labelId: p,
    setLabelId: g,
    items: m
  }), [p, g, m]), T = Tt("div", i, {
    ref: r,
    props: [{
      // `group` is not a valid owned element of `grid`, and `row` must be owned
      // by `grid`, `rowgroup`, or `treegrid`.
      role: h ? "rowgroup" : "group",
      "aria-labelledby": p
    }, v]
  }), A = /* @__PURE__ */ w.jsx(c1.Provider, {
    value: x,
    children: T
  });
  return m ? /* @__PURE__ */ w.jsx(sw, {
    items: m,
    children: A
  }) : A;
}), Iw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    id: m,
    ...v
  } = i, {
    setLabelId: y
  } = Hw(), h = wl(m);
  return Te(() => (y(h), () => {
    y((g) => g === h ? void 0 : g);
  }), [h, y]), Tt("div", i, {
    ref: r,
    props: [{
      id: h,
      "aria-hidden": !0
    }, v]
  });
}), f1 = /* @__PURE__ */ b.createContext(void 0);
function Vw() {
  const l = b.useContext(f1);
  if (!l)
    throw new Error(Rn(19));
  return l;
}
const Lw = /* @__PURE__ */ b.createContext(!1);
function Bw() {
  return b.useContext(Lw);
}
function d1(l) {
  const {
    componentProps: i,
    forwardedRef: r,
    virtualized: s,
    indexFromFilter: c
  } = l, {
    render: f,
    className: m,
    style: v,
    value: y = null,
    index: h,
    disabled: p = !1,
    nativeButton: g = !1,
    ...x
  } = i, T = b.useRef(null), A = Nc({
    guess: !0,
    index: h,
    textRef: T
  }), N = Bl(), E = Bw(), M = wO(), {
    props: R,
    id: I,
    selectionMode: C,
    disabled: z,
    readOnly: V,
    isItemEqualToValue: _
  } = N.useState("itemRoot"), U = z || p, j = C !== "none", H = h ?? c ?? A.index, q = H !== -1, $ = N.useState("isActive", H), Z = N.useState("isSelected", y), G = b.useRef(null), le = I != null && q ? `${I}-${H}` : void 0, k = Z && j;
  Te(() => {
    if (!(q && (s || h != null)))
      return;
    const B = N.context.listRef.current;
    return B[H] = G.current, () => {
      delete B[H];
    };
  }, [q, s, H, h, N]), Te(() => {
    if (!q || M)
      return;
    const O = N.context.valuesRef.current;
    return O[H] = y, () => {
      delete O[H];
    };
  }, [q, M, H, y, N]), Te(() => {
    if (!q || M)
      return;
    const O = N.state.selectedValue;
    let B = N.state.selectedIndex;
    N.state.selectionMode === "multiple" && Array.isArray(O) ? B = zO(H, y, N.context.valuesRef.current, O, _, B) : ci(y, O, _) && (B = H), N.set("selectedIndex", B);
  }, [q, M, N, H, y, _]);
  const {
    getButtonProps: ie,
    buttonRef: P
  } = Ua({
    disabled: U,
    focusableWhenDisabled: !0,
    native: g,
    composite: !0
  }), J = {
    disabled: U,
    selected: k,
    highlighted: $
  };
  function te(O) {
    function B() {
      N.context.handleSelection(O, y);
    }
    N.state.submitOnItemClick ? (zo.flushSync(B), N.context.requestSubmit()) : B();
  }
  const De = {
    id: le,
    role: E ? "gridcell" : "option",
    "aria-selected": j ? k : void 0,
    // Focusable items steal focus from the input upon mouseup.
    // Warn if the user renders a natively focusable element like `<button>`,
    // as it should be a `<div>` instead.
    tabIndex: void 0,
    onPointerDownCapture(O) {
      O.isPrimary && (N.context.pointerDownItemRef.current = O.currentTarget), O.preventDefault();
    },
    onMouseDown(O) {
      O.preventDefault();
    },
    onClick(O) {
      U || V || te(O.nativeEvent);
    },
    onMouseUp(O) {
      const B = N.context.pointerDownItemRef.current === O.currentTarget;
      N.context.pointerDownItemRef.current = null, !(U || V || O.button !== 0 || B || !$) && te(O.nativeEvent);
    }
  }, ge = Tt("div", i, {
    ref: [P, r, A.ref, G],
    state: J,
    props: [R, De, x, ie]
  }), ze = b.useMemo(() => ({
    selected: k,
    textRef: T
  }), [k, T]);
  return /* @__PURE__ */ w.jsx(f1.Provider, {
    value: ze,
    children: ge
  });
}
function qw(l) {
  const {
    componentProps: i,
    forwardedRef: r
  } = l, c = Bl().useState("isItemEqualToValue"), {
    flatFilteredValues: f
  } = zu(), m = i.value ?? null, v = X0(f, m, c);
  return /* @__PURE__ */ w.jsx(d1, {
    componentProps: i,
    forwardedRef: r,
    virtualized: !0,
    indexFromFilter: v
  });
}
const Gw = /* @__PURE__ */ b.memo(/* @__PURE__ */ b.forwardRef(function(i, r) {
  const c = Bl().useState("virtualized");
  return c && i.index == null ? /* @__PURE__ */ w.jsx(qw, {
    componentProps: i,
    forwardedRef: r
  }) : /* @__PURE__ */ w.jsx(d1, {
    componentProps: i,
    forwardedRef: r,
    virtualized: c,
    indexFromFilter: void 0
  });
})), Yw = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    children: m,
    ...v
  } = i, {
    filteredItems: y
  } = zu(), h = Bl(), p = gw(), g = y.length === 0 ? m : null;
  return Tt("div", i, {
    ref: [r, h.context.emptyRef, p],
    props: [{
      children: g,
      role: "status",
      "aria-live": "polite",
      "aria-atomic": !0
    }, v]
  });
}), kw = /* @__PURE__ */ b.createContext({
  disabled: !1
});
function Xw() {
  return b.useContext(kw);
}
function Kw(l, i, r, s = !0, c, f) {
  const [m, v] = b.useState(), y = wl(c ? `${c}-label` : void 0), h = !!f?.trim(), g = l ?? (h ? void 0 : i) ?? m;
  return Te(() => {
    const x = l || i || h || !s ? void 0 : Pw(r.current, y);
    m !== x && v(x);
  }), g;
}
function Pw(l, i) {
  const r = Qw(l);
  if (r)
    return !r.id && i && (r.id = i), r.id || void 0;
}
function Qw(l) {
  if (!l)
    return;
  const i = l.parentElement;
  if (i && i.tagName === "LABEL")
    return i;
  const r = l.id;
  if (r) {
    const c = l.nextElementSibling;
    if (c && c.htmlFor === r)
      return c;
  }
  const s = l.labels;
  return s && s[0];
}
function Zw(l, i) {
  return l.matches(":disabled") ? !1 : !i || l.form === i ? !0 : l.form === null && !l.hasAttribute("form");
}
function Fw(l) {
  const {
    multiple: i = !1,
    defaultValue: r,
    value: s,
    onValueChange: c,
    autoComplete: f,
    ...m
  } = l;
  return /* @__PURE__ */ w.jsx(ZO, {
    ...m,
    selectionMode: i ? "multiple" : "single",
    selectedValue: s,
    defaultSelectedValue: r,
    onSelectedValueChange: c,
    formAutoComplete: f
  });
}
const Jw = /* @__PURE__ */ b.memo(/* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    keepMounted: m,
    selected: v,
    ...y
  } = i, h = b.useRef(null), {
    transitionStatus: p,
    setMounted: g
  } = Tr(v), T = Tt("span", i, {
    ref: [r, h],
    state: {
      selected: v,
      transitionStatus: p
    },
    props: [{
      "aria-hidden": !0,
      children: "✔️"
    }, y],
    stateAttributesMapping: Qi
  });
  return Zi({
    batch: !0,
    enabled: !v,
    open: v,
    ref: h,
    onComplete() {
      v || g(!1);
    }
  }), T;
})), $w = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    selected: s
  } = Vw();
  return i.keepMounted || s ? /* @__PURE__ */ w.jsx(Jw, {
    ...i,
    selected: s,
    ref: r
  }) : null;
});
function m1(l = {}) {
  const {
    highlightItemOnHover: i,
    highlightedIndex: r,
    onHighlightedIndexChange: s
  } = S0(), {
    ref: c,
    index: f
  } = Nc(l), m = r === f, v = b.useRef(null), y = da(c, v);
  return {
    compositeProps: {
      tabIndex: m ? 0 : -1,
      onFocus() {
        s(f);
      },
      onMouseMove() {
        const p = v.current;
        if (!i || !p)
          return;
        const g = p.hasAttribute("disabled") || p.ariaDisabled === "true";
        !m && !g && p.focus();
      }
    },
    compositeRef: y,
    index: f
  };
}
function Ww(l) {
  const {
    render: i,
    className: r,
    style: s,
    state: c = un,
    props: f = Vl,
    refs: m = Vl,
    metadata: v,
    stateAttributesMapping: y,
    tag: h = "div",
    ...p
  } = l, {
    compositeProps: g,
    compositeRef: x
  } = m1({
    metadata: v
  });
  return Tt(h, l, {
    state: c,
    // The composite ref attaches first so an outer item wins when nested items share a DOM node.
    ref: [x, ...m],
    props: [g, ...f, p],
    stateAttributesMapping: y
  });
}
function e4(l) {
  return l == null || l.hasAttribute("disabled") || l.getAttribute("aria-disabled") === "true";
}
const t4 = T2(function(i) {
  return fO("dialog", i);
}), n4 = /* @__PURE__ */ b.createContext(void 0);
function l4(l = !1) {
  const i = b.useContext(n4);
  if (!i && !l)
    throw new Error(Rn(86));
  return i;
}
const a4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    id: f,
    name: m,
    value: v,
    disabled: y = !1,
    onValueChange: h,
    defaultValue: p,
    autoFocus: g = !1,
    style: x,
    ...T
  } = i, {
    state: A,
    name: N,
    disabled: E,
    setTouched: M,
    setDirty: R,
    validityData: I,
    setFilled: C,
    validationMode: z,
    validation: V
  } = mi(), {
    clearErrors: _,
    elementRef: U,
    submitCountRef: j
  } = Q0(), H = E || y, q = N ?? m, $ = {
    ...A,
    disabled: H
  }, {
    labelId: Z
  } = Or(), G = Pc({
    id: f
  }), le = v !== void 0, k = v == null ? void 0 : String(v), ie = Re(() => V.inputRef.current?.value);
  P0(V.inputRef, G, k, ie, !H, m), Te(() => {
    const ge = k ?? V.inputRef.current?.value;
    ge !== void 0 && C(ge !== "");
  }, [k, p, V.inputRef, C]), oi(k, () => {
    k !== void 0 && (_(q), R(k !== (I.initialValue ?? "")), V.change(k));
  });
  const P = b.useRef(null), J = Zc(H, P), te = _a();
  return Tt("input", i, {
    ref: [r, P],
    state: $,
    props: [{
      id: G,
      disabled: H,
      name: q,
      ref: V.inputRef,
      "aria-labelledby": Z,
      autoFocus: g,
      ...le ? {
        value: v
      } : {
        defaultValue: p
      },
      onChange(ge) {
        const ze = ge.currentTarget.value, O = it(Yn, ge.nativeEvent);
        h?.(ze, O), !le && (R(ze !== (I.initialValue ?? "")), C(ze !== ""), !ge.nativeEvent.defaultPrevented && !O.isCanceled && (_(q), V.change(ze)));
      },
      onFocus() {
        J(!0);
      },
      onBlur(ge) {
        if (M(!0), J(!1), z === "onBlur") {
          const ze = ge.currentTarget.value;
          V.commit(ze), le && queueMicrotask(() => {
            const O = V.inputRef.current?.value;
            O !== void 0 && O !== ze && O !== (I.initialValue ?? "") && V.commit(O);
          });
        }
      },
      onKeyDown(ge) {
        if (ge.currentTarget.tagName === "INPUT" && ge.key === "Enter") {
          M(!0);
          const ze = ge.currentTarget.value, O = ge.currentTarget.form;
          if (O && O === U.current && !ge.defaultPrevented) {
            const B = ge.currentTarget, ce = j.current;
            te.start(0, () => {
              j.current === ce && V.commit(B.value);
            });
          } else
            V.commit(ze);
        }
      }
    }, T, (ge) => V.getValidationProps(H, ge)],
    stateAttributesMapping: Kc
  });
}), i4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  return /* @__PURE__ */ w.jsx(a4, {
    ref: r,
    ...i
  });
}), Jc = "data-composite-item-active";
function o4(l) {
  const {
    loopFocus: i = !0,
    orientation: r = "both",
    grid: s,
    onLoop: c,
    direction: f,
    highlightedIndex: m,
    onHighlightedIndexChange: v,
    rootRef: y,
    enableHomeAndEndKeys: h = !1,
    stopEventPropagation: p,
    disabledIndices: g,
    modifierKeys: x = Vl
  } = l, [T, A] = b.useState(0), N = s != null, E = b.useRef(null), M = da(E, y), R = b.useRef([]), I = b.useRef(!1), C = b.useRef(null), z = m ?? T, V = Re((q, $ = !1) => {
    if (C.current = R.current[q] ?? null, (v ?? A)(q), $) {
      const Z = R.current[q];
      Pb(E.current, Z, f, r);
    }
  }), _ = Re((q) => {
    if (q.size === 0)
      return;
    if (I.current) {
      const le = R.current, k = le.indexOf(C.current);
      if (k === -1) {
        const ie = le[z];
        !ie || ki(le, z, g) ? V(r4(le, g)) : C.current = ie;
      } else k !== z && V(k);
      return;
    }
    I.current = !0;
    const $ = Array.from(q.keys()), Z = $.find((le) => le?.hasAttribute(Jc)) ?? null, G = Z ? q.get(Z)?.index ?? -1 : -1;
    if (G !== -1)
      V(G);
    else if (ki($, z, g)) {
      const le = bl($, {
        disabledIndices: g
      });
      si($, le) || V(le);
    }
    Pb(E.current, Z, f, r);
  });
  Te(() => {
    if (g == null || m != null || !I.current)
      return;
    const q = R.current;
    if (ki(q, z, g)) {
      const $ = bl(q, {
        disabledIndices: g
      });
      si(q, $) || V($);
    }
  }, [g, m, z, R, V]);
  const U = Re((q, $, Z) => c ? c(q, $, Z, R) : Z), j = Re((q) => {
    const $ = q.key === i0 || q.key === o0;
    if (!L2.has(q.key) || !h && $ || u4(q, x) || !E.current)
      return;
    const G = f === "rtl", le = G ? l0 : a0, k = G ? a0 : l0, ie = r === "vertical" ? n0 : le, P = r === "vertical" ? t0 : k, J = cl(q.nativeEvent);
    if (J != null && Kb(J) && !e4(J)) {
      const B = J.selectionStart, ce = J.selectionEnd, oe = J.value;
      if (B == null || q.shiftKey || B !== ce || q.key !== P && B < oe.length || q.key !== ie && B > 0)
        return;
    }
    let te = z;
    const De = oc(R, g), ge = Jm(R, g);
    s != null && (te = s({
      disabledIndices: g,
      elementsRef: R,
      event: q,
      highlightedIndex: z,
      loopFocus: i,
      maxIndex: ge,
      minIndex: De,
      onLoop: U,
      orientation: r,
      rtl: G
    }));
    const ze = r !== "vertical" && q.key === le || r !== "horizontal" && q.key === n0, O = r !== "vertical" && q.key === k || r !== "horizontal" && q.key === t0;
    h && (q.key === i0 ? te = De : q.key === o0 && (te = ge)), te === z && (ze || O) && (i && te === ge && ze ? (te = De, c && (te = c(q, z, te, R))) : i && te === De && O ? (te = ge, c && (te = c(q, z, te, R))) : te = bl(R.current, {
      startingIndex: te,
      decrement: O,
      disabledIndices: g
    })), te !== z && !si(R.current, te) && (p && q.stopPropagation(), (N || $ || ze || O) && q.preventDefault(), V(te, !0), queueMicrotask(() => {
      R.current[te]?.focus();
    }));
  });
  return {
    props: {
      ref: M,
      onFocus(q) {
        const $ = E.current, Z = cl(q.nativeEvent);
        !$ || Z == null || !Kb(Z) || Z.setSelectionRange(0, Z.value.length);
      },
      onKeyDown: j
    },
    highlightedIndex: z,
    onHighlightedIndexChange: V,
    elementsRef: R,
    onMapChange: _,
    relayKeyboardEvent: j
  };
}
function r4(l, i) {
  let r = -1;
  for (let s = 0; s < l.length; s += 1) {
    const c = l[s];
    if (!(!c || ki(l, s, i))) {
      if (c.hasAttribute(Jc))
        return s;
      r === -1 && (r = s);
    }
  }
  return Math.max(r, 0);
}
function u4(l, i) {
  for (const r of hO)
    if (!i.includes(r) && l.getModifierState(r))
      return !0;
  return !1;
}
function g1(l) {
  const {
    render: i,
    className: r,
    style: s,
    refs: c = Vl,
    props: f = Vl,
    state: m = un,
    stateAttributesMapping: v,
    highlightedIndex: y,
    onHighlightedIndexChange: h,
    orientation: p,
    grid: g,
    loopFocus: x,
    onLoop: T,
    enableHomeAndEndKeys: A,
    onMapChange: N,
    stopEventPropagation: E = !0,
    rootRef: M,
    disabledIndices: R,
    modifierKeys: I,
    highlightItemOnHover: C = !1,
    tag: z = "div",
    ...V
  } = l, _ = Qc(), {
    props: U,
    highlightedIndex: j,
    onHighlightedIndexChange: H,
    elementsRef: q,
    onMapChange: $,
    relayKeyboardEvent: Z
  } = o4({
    grid: g,
    loopFocus: x,
    onLoop: T,
    orientation: p,
    highlightedIndex: y,
    onHighlightedIndexChange: h,
    rootRef: M,
    stopEventPropagation: E,
    enableHomeAndEndKeys: A,
    direction: _,
    disabledIndices: R,
    modifierKeys: I
  }), G = Tt(z, l, {
    state: m,
    ref: c,
    props: [U, ...f, V],
    stateAttributesMapping: v
  }), le = b.useMemo(() => ({
    highlightedIndex: j,
    onHighlightedIndexChange: H,
    highlightItemOnHover: C,
    relayKeyboardEvent: Z
  }), [j, H, C, Z]);
  return /* @__PURE__ */ w.jsx(Qy.Provider, {
    value: le,
    children: /* @__PURE__ */ w.jsx(wc, {
      elementsRef: q,
      onMapChange: (k) => {
        N?.(k), $(k);
      },
      children: G
    })
  });
}
const s4 = "data-checked", c4 = "data-unchecked", r0 = {
  checked(l) {
    return l ? {
      [s4]: ""
    } : {
      [c4]: ""
    };
  },
  ...Qi,
  ...Kc
}, h1 = /* @__PURE__ */ b.createContext(void 0);
function f4() {
  return b.useContext(h1);
}
const p1 = /* @__PURE__ */ b.createContext(void 0);
function d4() {
  const l = b.useContext(p1);
  if (l === void 0)
    throw new Error(Rn(52));
  return l;
}
const m4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    disabled: f = !1,
    readOnly: m = !1,
    required: v = !1,
    "aria-labelledby": y,
    value: h,
    inputRef: p,
    nativeButton: g = !1,
    id: x,
    style: T,
    ...A
  } = i, N = f4(), {
    disabled: E,
    readOnly: M,
    required: R,
    form: I,
    checkedValue: C,
    touched: z = !1,
    validation: V,
    name: _,
    setCheckedValue: U = zt,
    setTouched: j = zt,
    registerInputRef: H = zt
  } = N ?? {}, {
    setTouched: q,
    setFilled: $,
    state: Z,
    disabled: G
  } = mi(), le = Xw(), {
    labelId: k,
    getDescriptionProps: ie
  } = Or(), P = G || le.disabled || E || f, J = M || m, te = R || v, De = I, ge = N ? C === h : h === "", ze = b.useRef(null), O = Zc(P, ze), B = b.useRef(null), ce = V?.registerInput, oe = b.useCallback((je) => ce?.(je, {
    controlRef: ze,
    value: void 0
  }), [ce]), ye = da(p, B, H, oe);
  Te(() => {
    B.current?.checked && $(!0);
  }, [$]), Te(() => {
    if (B.current) {
      if (P && ge) {
        H(null);
        return;
      }
      H(B.current);
    }
  }, [ge, P, H]);
  const de = wl(), Ae = Pc({
    id: x
  }), pe = g ? void 0 : Ae, xe = Kw(y, k, B, !g, pe, A["aria-label"]), Ke = {
    role: "radio",
    "aria-checked": ge,
    "aria-labelledby": xe,
    [Jc]: ge ? "" : void 0,
    id: g ? Ae : de,
    onKeyDown(je) {
      je.key === "Enter" && je.preventDefault();
    },
    onClick(je) {
      if (je.defaultPrevented || P || J)
        return;
      je.preventDefault();
      const Pe = B.current;
      Pe && ic(Pe, je);
    },
    onFocus(je) {
      O(!0), !(je.defaultPrevented || P || J || !z) && (B.current?.click(), j(!1));
    },
    onBlur() {
      N || O(!1);
    }
  }, {
    getButtonProps: Ue,
    buttonRef: Le
  } = Ua({
    disabled: P,
    native: g,
    composite: !1
  }), Se = {
    type: "radio",
    ref: ye,
    form: De,
    id: pe,
    name: _,
    tabIndex: -1,
    style: _ ? N0 : M0,
    "aria-hidden": !0,
    ...h !== void 0 ? {
      value: Cc(h)
    } : un,
    disabled: P,
    checked: ge,
    required: te,
    readOnly: J,
    onChange(je) {
      if (je.nativeEvent.defaultPrevented || P || J || h === void 0)
        return;
      const Pe = it(Yn, je.nativeEvent);
      U(h, Pe), !Pe.isCanceled && q(!0);
    },
    onClick(je) {
      je.stopPropagation();
    },
    onFocus() {
      ze.current?.focus();
    }
  }, be = b.useMemo(() => ({
    ...Z,
    required: te,
    disabled: P,
    readOnly: J,
    checked: ge
  }), [Z, P, J, ge, te]), Ne = be, Ee = N !== void 0, Ye = [r, ze, Le], re = [Ke, A, Ue, ie, V ? (je) => V.getValidationProps(P, je) : un], Me = Tt("span", i, {
    enabled: !Ee,
    state: be,
    ref: Ye,
    props: re,
    stateAttributesMapping: r0
  });
  return /* @__PURE__ */ w.jsxs(p1.Provider, {
    value: Ne,
    children: [Ee ? /* @__PURE__ */ w.jsx(Ww, {
      tag: "span",
      render: s,
      className: c,
      style: T,
      state: be,
      refs: Ye,
      props: re,
      stateAttributesMapping: r0
    }) : Me, /* @__PURE__ */ w.jsx("input", {
      ...Se,
      suppressHydrationWarning: !0
    })]
  });
}), g4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    style: f,
    keepMounted: m = !1,
    ...v
  } = i, y = d4(), h = y.checked, {
    mounted: p,
    transitionStatus: g,
    setMounted: x
  } = Tr(h), T = {
    ...y,
    transitionStatus: g
  }, A = b.useRef(null), N = m || p, E = Tt("span", i, {
    ref: [r, A],
    state: T,
    props: v,
    stateAttributesMapping: r0
  });
  return Zi({
    batch: !0,
    enabled: !h,
    open: h,
    ref: A,
    onComplete() {
      h || x(!1);
    }
  }), N ? E : null;
}), h4 = [B2], p4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    render: s,
    className: c,
    disabled: f,
    readOnly: m,
    required: v,
    onValueChange: y,
    value: h,
    defaultValue: p,
    form: g,
    name: x,
    inputRef: T,
    id: A,
    style: N,
    ...E
  } = i, {
    setTouched: M,
    setFocused: R,
    validationMode: I,
    name: C,
    disabled: z,
    state: V,
    validation: _,
    setDirty: U,
    setFilled: j,
    validityData: H
  } = mi(), {
    labelId: q
  } = Or(), {
    clearErrors: $,
    elementRef: Z
  } = Q0(), G = l4(!0), le = z || f, k = C ?? x, ie = wl(A), [P, J] = To({
    controlled: h,
    default: p,
    name: "RadioGroup",
    state: "value"
  }), [te, De] = b.useState(!1), ge = Re((Se, be) => {
    y?.(Se, be), !be.isCanceled && J(Se);
  }), ze = _.getInputControl, O = b.useMemo(() => ({
    get current() {
      return ze();
    }
  }), [ze]), B = b.useRef(null), ce = b.useRef(null), oe = da(B, T), ye = b.useRef(oe), de = Re((Se) => {
    B.current === Se && ye.current === oe || (ye.current = oe, oe?.(Se));
  });
  Te(() => {
    de(B.current);
  }, [oe, de]);
  const Ae = Re((Se) => {
    if (Se) {
      if (!Se.disabled) {
        ce.current || (ce.current = Se);
        const be = B.current;
        (Se.checked || be == null || be.disabled) && de(Se);
      }
      return () => {
        ce.current === Se && (ce.current = null), B.current === Se && de(null);
      };
    }
  }), pe = Re(() => {
    const Se = Z.current;
    if (!Se)
      return P ?? null;
    for (const be of _.registeredInputs.keys())
      if (be.checked && Zw(be, Se))
        return P ?? null;
    return null;
  });
  P0(O, ie, P ?? null, pe, !le, x), oi(P, () => {
    $(k), U(P !== H.initialValue), j(P != null), _.change(P);
    const Se = ce.current;
    P == null && Se && !Se.disabled && de(Se);
  });
  const xe = q ?? G?.legendId, Ke = {
    ...V,
    disabled: le ?? !1,
    required: v ?? !1,
    readOnly: m ?? !1
  }, Ue = b.useMemo(() => ({
    checkedValue: P,
    disabled: le,
    form: g,
    validation: _,
    name: k,
    readOnly: m,
    registerInputRef: Ae,
    required: v,
    setCheckedValue: ge,
    setTouched: De,
    touched: te
  }), [P, le, g, _, k, m, Ae, v, ge, De, te]), Le = {
    id: A,
    role: "radiogroup",
    "aria-required": v || void 0,
    "aria-disabled": le || void 0,
    "aria-readonly": m || void 0,
    "aria-labelledby": xe,
    onBlur(Se) {
      et(Se.currentTarget, Se.relatedTarget) || (De(!1), M(!0), R(!1), I === "onBlur" && _.commit(P));
    },
    onKeyDownCapture(Se) {
      Se.key.startsWith("Arrow") && De(!0);
    }
  };
  return /* @__PURE__ */ w.jsx(h1.Provider, {
    value: Ue,
    children: /* @__PURE__ */ w.jsx(g1, {
      render: s,
      className: c,
      style: N,
      state: Ke,
      props: [Le, E, (Se) => _.getValidationProps(le ?? !1, Se)],
      refs: [r],
      stateAttributesMapping: Kc,
      enableHomeAndEndKeys: !1,
      modifierKeys: h4
    })
  });
}), v1 = /* @__PURE__ */ b.createContext(void 0);
function F0() {
  const l = b.useContext(v1);
  if (l === void 0)
    throw new Error(Rn(64));
  return l;
}
const v4 = "data-activation-direction", $c = {
  tabActivationDirection: (l) => ({
    [v4]: l
  })
}, b4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    className: s,
    defaultValue: c = 0,
    onValueChange: f,
    orientation: m = "horizontal",
    render: v,
    value: y,
    style: h,
    ...p
  } = i, g = i.defaultValue !== void 0, x = b.useRef([]), [T, A] = b.useState(() => /* @__PURE__ */ new Map()), [N, E] = To({
    controlled: y,
    default: c,
    name: "Tabs",
    state: "value"
  }), M = y !== void 0, [R, I] = b.useState(() => /* @__PURE__ */ new Map()), C = b.useRef(void 0), z = b.useCallback((ye) => u0(R, ye), [R]), [V, _] = b.useState(() => ({
    previousValue: N,
    tabActivationDirection: "none"
  })), {
    previousValue: U,
    tabActivationDirection: j
  } = V;
  let H = j, q = !1;
  U !== N && (H = ey(U, N, m, R), q = U != null && N != null && z(N) == null);
  const $ = q ? U : N, Z = U !== $ || j !== H;
  Te(() => {
    Z && _({
      previousValue: $,
      tabActivationDirection: H
    });
  }, [$, Z, H]);
  const G = Re((ye, de) => {
    const Ae = ey(N, ye, m, R);
    de.activationDirection = Ae, f?.(ye, de), !de.isCanceled && E(() => ye);
  }), le = Re((ye, de) => {
    f?.(ye, it(de, void 0, void 0, {
      activationDirection: "none"
    }));
  }), k = Re((ye, de) => (A((Ae) => {
    const pe = new Map(Ae);
    return pe.set(ye, de), pe;
  }), () => {
    A((Ae) => {
      if (Ae.get(ye) !== de)
        return Ae;
      const pe = new Map(Ae);
      return pe.delete(ye), pe;
    });
  })), ie = b.useCallback((ye) => T.get(ye), [T]), P = b.useCallback((ye) => {
    for (const de of R.values())
      if (ye === de.value)
        return de.id;
  }, [R]), J = b.useMemo(() => ({
    getTabElementBySelectedValue: z,
    getTabIdByPanelValue: P,
    getTabPanelIdByValue: ie,
    onValueChange: G,
    orientation: m,
    registerMountedTabPanel: k,
    setTabMap: I,
    tabActivationDirection: H,
    value: N
  }), [z, P, ie, G, m, k, I, H, N]), te = b.useMemo(() => {
    for (const ye of R.values())
      if (ye.value === N)
        return ye;
  }, [R, N]), De = b.useMemo(() => {
    for (const ye of R.values())
      if (!ye.disabled)
        return ye.value;
  }, [R]), ge = b.useRef(!g), ze = b.useRef(c), O = b.useRef(g), B = b.useRef(!1);
  Te(() => {
    if (M)
      return;
    function ye(xe, Ke) {
      E(() => xe), _({
        previousValue: xe,
        tabActivationDirection: "none"
      }), le(xe, Ke), ge.current = !1;
    }
    if (R.size === 0) {
      B.current && N !== null && !C.current?.isConnected && ye(null, sb);
      return;
    }
    B.current = !0, C.current = R.keys().next().value;
    const de = te?.disabled, Ae = te == null && N !== null;
    if (!de && N === ze.current && (O.current = !1), O.current && de && N === ze.current)
      return;
    const pe = ge.current;
    if (de || Ae) {
      const xe = De ?? null;
      if (N === xe) {
        ge.current = !1;
        return;
      }
      let Ke = sb;
      pe ? Ke = cb : de && (Ke = QC), ye(xe, Ke);
      return;
    }
    pe && te != null && (le(N, cb), ge.current = !1);
  }, [De, M, le, te, E, R, N]);
  const oe = Tt("div", i, {
    state: {
      orientation: m,
      tabActivationDirection: H
    },
    ref: r,
    props: p,
    stateAttributesMapping: $c
  });
  return /* @__PURE__ */ w.jsx(v1.Provider, {
    value: J,
    children: /* @__PURE__ */ w.jsx(wc, {
      elementsRef: x,
      children: oe
    })
  });
});
function u0(l, i) {
  for (const [r, s] of l.entries())
    if (i === s.value)
      return r;
  return null;
}
function ey(l, i, r, s) {
  if (l == null || i == null)
    return "none";
  const [c, f, m] = r === "horizontal" ? ["left", "left", "right"] : ["top", "up", "down"], v = u0(s, l), y = u0(s, i);
  if (v == null || y == null)
    return v !== y && (typeof l == "number" || typeof l == "string") && typeof l == typeof i ? i > l ? m : f : "none";
  const h = v.getBoundingClientRect()[c], p = y.getBoundingClientRect()[c];
  return p < h ? f : p > h ? m : "none";
}
const b1 = /* @__PURE__ */ b.createContext(void 0);
function y4() {
  const l = b.useContext(b1);
  if (l === void 0)
    throw new Error(Rn(65));
  return l;
}
const x4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    className: s,
    disabled: c = !1,
    render: f,
    value: m,
    id: v,
    nativeButton: y = !0,
    style: h,
    ...p
  } = i, {
    value: g,
    getTabPanelIdByValue: x,
    onValueChange: T,
    orientation: A,
    tabActivationDirection: N
  } = F0(), {
    activateOnFocus: E,
    registerTabResizeObserverElement: M,
    tabsListElement: R
  } = y4(), {
    highlightedIndex: I,
    onHighlightedIndexChange: C
  } = S0(), z = wl(v), V = b.useMemo(() => ({
    disabled: c,
    id: z,
    value: m
  }), [c, z, m]), {
    compositeProps: _,
    compositeRef: U,
    index: j
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = m1({
    metadata: V
  }), H = m === g, q = b.useRef(!1), $ = b.useRef(null), Z = Re((B) => {
    $.current?.(), $.current = B ? M(B) : null;
  });
  Te(() => {
    if (q.current) {
      q.current = !1;
      return;
    }
    if (!(H && j > -1 && I !== j))
      return;
    const B = R;
    if (B != null) {
      const ce = Ol(Qt(B));
      if (ce && et(B, ce))
        return;
    }
    c || C(j);
  }, [H, j, I, C, c, R]);
  const {
    getButtonProps: G,
    buttonRef: le
  } = Ua({
    disabled: c,
    native: y,
    focusableWhenDisabled: !0
  }), k = x(m), ie = b.useRef(!1), P = b.useRef(!1);
  function J(B) {
    T(m, it(Yn, B.nativeEvent, void 0, {
      activationDirection: "none"
    }));
  }
  function te(B) {
    H || c || J(B);
  }
  function De(B) {
    H || c || E && (!ie.current || // keyboard or touch focus
    P.current) && J(B);
  }
  function ge(B) {
    if (H || c)
      return;
    ie.current = !0, P.current = B.button === 0;
    const ce = Qt(B.currentTarget);
    function oe() {
      ie.current = !1, P.current = !1, ce.removeEventListener("pointerup", oe), ce.removeEventListener("pointercancel", oe);
    }
    ce.addEventListener("pointerup", oe), ce.addEventListener("pointercancel", oe);
  }
  return Tt("button", i, {
    state: {
      disabled: c,
      active: H,
      orientation: A,
      tabActivationDirection: N
    },
    ref: [r, le, U, Z],
    props: [_, {
      role: "tab",
      "aria-controls": k,
      "aria-selected": H,
      id: z,
      onClick: te,
      onFocus: De,
      onPointerDown: ge,
      [Jc]: H ? "" : void 0,
      onKeyDownCapture() {
        q.current = !0;
      }
    }, p, G],
    stateAttributesMapping: $c
  });
}), S4 = "data-index", E4 = {
  ...$c,
  ...Qi
}, C4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    className: s,
    value: c,
    render: f,
    keepMounted: m = !1,
    style: v,
    ...y
  } = i, {
    value: h,
    getTabIdByPanelValue: p,
    orientation: g,
    tabActivationDirection: x,
    registerMountedTabPanel: T
  } = F0(), A = wl(), {
    ref: N,
    index: E
  } = Nc(), M = c === h, {
    mounted: R,
    transitionStatus: I,
    setMounted: C
  } = Tr(M), z = !R, V = p(c), _ = {
    hidden: z,
    orientation: g,
    tabActivationDirection: x,
    transitionStatus: I
  }, U = b.useRef(null), j = Tt("div", i, {
    state: _,
    ref: [r, N, U],
    props: [{
      "aria-labelledby": V,
      hidden: z,
      id: A,
      role: "tabpanel",
      tabIndex: M ? 0 : -1,
      inert: q0(!M),
      // Computed key: a plain literal key fails the DOM-props excess property check.
      [S4]: E
    }, y],
    stateAttributesMapping: E4
  });
  return Zi({
    open: M,
    ref: U,
    onComplete() {
      M || C(!1);
    }
  }), Te(() => {
    if (!(A == null || z && !m))
      return T(c, A);
  }, [z, m, c, A, T]), m || R ? j : null;
}), R4 = /* @__PURE__ */ b.forwardRef(function(i, r) {
  const {
    activateOnFocus: s = !1,
    className: c,
    loopFocus: f = !0,
    render: m,
    style: v,
    ...y
  } = i, {
    orientation: h,
    setTabMap: p,
    tabActivationDirection: g
  } = F0(), [x, T] = b.useState(0), [A, N] = b.useState(null), E = b.useRef(/* @__PURE__ */ new Set()), M = b.useRef(/* @__PURE__ */ new Set()), R = b.useRef(null);
  Te(() => {
    if (typeof ResizeObserver > "u")
      return;
    const U = new ResizeObserver(() => {
      E.current.forEach((j) => {
        j();
      });
    });
    return R.current = U, A && U.observe(A), M.current.forEach((j) => {
      U.observe(j);
    }), () => {
      U.disconnect(), R.current = null;
    };
  }, [A]);
  const I = Re((U) => (E.current.add(U), () => {
    E.current.delete(U);
  })), C = Re((U) => (M.current.add(U), R.current?.observe(U), () => {
    M.current.delete(U), R.current?.unobserve(U);
  })), z = {
    orientation: h,
    tabActivationDirection: g
  }, V = {
    "aria-orientation": h === "vertical" ? "vertical" : void 0,
    role: "tablist"
  }, _ = b.useMemo(() => ({
    activateOnFocus: s,
    registerIndicatorUpdateListener: I,
    registerTabResizeObserverElement: C,
    tabsListElement: A
  }), [s, I, C, A]);
  return /* @__PURE__ */ w.jsx(b1.Provider, {
    value: _,
    children: /* @__PURE__ */ w.jsx(g1, {
      render: m,
      className: c,
      style: v,
      state: z,
      refs: [r, N],
      props: [V, y],
      stateAttributesMapping: $c,
      highlightedIndex: x,
      enableHomeAndEndKeys: !0,
      loopFocus: f,
      orientation: h,
      onHighlightedIndexChange: T,
      onMapChange: p,
      disabledIndices: Vl
    })
  });
});
function y1({ className: l, type: i, ...r }) {
  return /* @__PURE__ */ w.jsx(
    i4,
    {
      type: i,
      "data-slot": "input",
      className: $e(
        "va:h-8 va:w-full va:min-w-0 va:rounded-lg va:border va:border-input va:bg-transparent va:px-2.5 va:py-1 va:text-base va:transition-colors va:outline-none va:file:inline-flex va:file:h-6 va:file:border-0 va:file:bg-transparent va:file:text-sm va:file:font-medium va:file:text-foreground va:placeholder:text-muted-foreground va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:pointer-events-none va:disabled:cursor-not-allowed va:disabled:bg-input/50 va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:md:text-sm va:dark:bg-input/30 va:dark:disabled:bg-input/80 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40",
        l
      ),
      ...r
    }
  );
}
function T4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "input-group",
      role: "group",
      className: $e(
        "va:group/input-group va:relative va:flex va:h-8 va:w-full va:min-w-0 va:items-center va:rounded-lg va:border va:border-input va:transition-colors va:outline-none va:in-data-[slot=combobox-content]:focus-within:border-inherit va:in-data-[slot=combobox-content]:focus-within:ring-0 va:has-disabled:bg-input/50 va:has-disabled:opacity-50 va:has-[[data-slot=input-group-control]:focus-visible]:border-ring va:has-[[data-slot=input-group-control]:focus-visible]:ring-3 va:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 va:has-[[data-slot][aria-invalid=true]]:border-destructive va:has-[[data-slot][aria-invalid=true]]:ring-3 va:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 va:has-[>[data-align=block-end]]:h-auto va:has-[>[data-align=block-end]]:flex-col va:has-[>[data-align=block-start]]:h-auto va:has-[>[data-align=block-start]]:flex-col va:has-[>textarea]:h-auto    va:has-[>[data-align=block-end]]:[&>input]:pt-3 va:has-[>[data-align=block-start]]:[&>input]:pb-3 va:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 va:has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        l
      ),
      ...i
    }
  );
}
const A4 = Ar(
  "va:flex va:h-auto va:cursor-text va:items-center va:justify-center va:gap-2 va:py-1.5 va:text-sm va:font-medium va:text-muted-foreground va:select-none va:group-data-[disabled=true]/input-group:opacity-50 va:[&>kbd]:rounded-[calc(var(--radius)-5px)] va:[&>svg:not([class*=size-])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "va:order-first va:pl-2 va:has-[>button]:ml-[-0.3rem] va:has-[>kbd]:ml-[-0.15rem]",
        "inline-end": "va:order-last va:pr-2 va:has-[>button]:mr-[-0.3rem] va:has-[>kbd]:mr-[-0.15rem]",
        "block-start": "va:order-first va:w-full va:justify-start va:px-2.5 va:pt-2 va:group-has-[>input]/input-group:pt-2 va:[.border-b]:pb-2",
        "block-end": "va:order-last va:w-full va:justify-start va:px-2.5 va:pb-2 va:group-has-[>input]/input-group:pb-2 va:[.border-t]:pt-2"
      }
    },
    defaultVariants: {
      align: "inline-start"
    }
  }
);
function x1({
  className: l,
  align: i = "inline-start",
  ...r
}) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      role: "group",
      "data-slot": "input-group-addon",
      "data-align": i,
      className: $e(A4({ align: i }), l),
      onClick: (s) => {
        s.target.closest("button") || s.currentTarget.parentElement?.querySelector("input")?.focus();
      },
      ...r
    }
  );
}
const O4 = Ar(
  "va:flex va:items-center va:gap-2 va:text-sm va:shadow-none",
  {
    variants: {
      size: {
        xs: "va:h-6 va:gap-1 va:rounded-[calc(var(--radius)-3px)] va:px-1.5 va:[&>svg:not([class*=size-])]:size-3.5",
        sm: "va:h-7 va:px-2",
        "icon-xs": "va:size-6 va:rounded-[calc(var(--radius)-3px)] va:p-0 va:has-[>svg]:p-0",
        "icon-sm": "va:size-8 va:p-0 va:has-[>svg]:p-0"
      }
    },
    defaultVariants: {
      size: "xs"
    }
  }
);
function S1({
  className: l,
  type: i = "button",
  variant: r = "ghost",
  size: s = "xs",
  ...c
}) {
  return /* @__PURE__ */ w.jsx(
    za,
    {
      type: i,
      "data-size": s,
      variant: r,
      className: $e(O4({ size: s }), l),
      ...c
    }
  );
}
function w4({
  className: l,
  ...i
}) {
  return /* @__PURE__ */ w.jsx(
    y1,
    {
      "data-slot": "input-group-control",
      className: $e(
        "va:flex-1 va:rounded-none va:border-0 va:bg-transparent va:shadow-none va:ring-0 va:focus-visible:ring-0 va:disabled:bg-transparent va:aria-invalid:ring-0  ",
        l
      ),
      ...i
    }
  );
}
const M4 = Fw;
function E1({
  className: l,
  children: i,
  ...r
}) {
  return /* @__PURE__ */ w.jsxs(
    nw,
    {
      "data-slot": "combobox-trigger",
      className: $e("va:[&_svg:not([class*=size-])]:size-4", l),
      ...r,
      children: [
        i,
        /* @__PURE__ */ w.jsx(yy, { className: "va:pointer-events-none va:size-4 va:text-muted-foreground" })
      ]
    }
  );
}
function N4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    rw,
    {
      "data-slot": "combobox-clear",
      render: /* @__PURE__ */ w.jsx(S1, { variant: "ghost", size: "icon-xs" }),
      className: $e(l),
      ...i,
      children: /* @__PURE__ */ w.jsx(c0, { className: "va:pointer-events-none" })
    }
  );
}
function D4({
  className: l,
  children: i,
  disabled: r = !1,
  showTrigger: s = !0,
  showClear: c = !1,
  ...f
}) {
  return /* @__PURE__ */ w.jsxs(T4, { className: $e("va:w-auto", l), children: [
    /* @__PURE__ */ w.jsx(
      iw,
      {
        render: /* @__PURE__ */ w.jsx(w4, { disabled: r }),
        ...f
      }
    ),
    /* @__PURE__ */ w.jsxs(x1, { align: "inline-end", children: [
      s && /* @__PURE__ */ w.jsx(
        S1,
        {
          size: "icon-xs",
          variant: "ghost",
          render: /* @__PURE__ */ w.jsx(E1, {}),
          "data-slot": "input-group-button",
          className: "va:group-has-data-[slot=combobox-clear]/input-group:hidden va:data-pressed:bg-transparent",
          disabled: r
        }
      ),
      c && /* @__PURE__ */ w.jsx(N4, { disabled: r })
    ] }),
    i
  ] });
}
function z4({
  className: l,
  side: i = "bottom",
  sideOffset: r = 6,
  align: s = "start",
  alignOffset: c = 0,
  anchor: f,
  portalContainer: m,
  ...v
}) {
  return /* @__PURE__ */ w.jsx(pw, { container: m, children: /* @__PURE__ */ w.jsx(
    zw,
    {
      side: i,
      sideOffset: r,
      align: s,
      alignOffset: c,
      anchor: f,
      className: "va:isolate va:z-50",
      children: /* @__PURE__ */ w.jsx(
        jw,
        {
          "data-slot": "combobox-content",
          "data-chips": !!f,
          className: $e("va:group/combobox-content va:relative va:max-h-(--available-height) va:w-(--anchor-width) va:max-w-(--available-width) va:min-w-[calc(var(--anchor-width)+--spacing(7))] va:origin-(--transform-origin) va:overflow-hidden va:rounded-lg va:bg-popover va:text-popover-foreground va:shadow-md va:ring-1 va:ring-foreground/10 va:duration-100 va:data-[chips=true]:min-w-(--anchor-width) va:data-[side=bottom]:slide-in-from-top-2 va:data-[side=inline-end]:slide-in-from-left-2 va:data-[side=inline-start]:slide-in-from-right-2 va:data-[side=left]:slide-in-from-right-2 va:data-[side=right]:slide-in-from-left-2 va:data-[side=top]:slide-in-from-bottom-2 va:*:data-[slot=input-group]:m-1 va:*:data-[slot=input-group]:mb-0 va:*:data-[slot=input-group]:h-8 va:*:data-[slot=input-group]:border-input/30 va:*:data-[slot=input-group]:bg-input/30 va:*:data-[slot=input-group]:shadow-none va:data-open:animate-in va:data-open:fade-in-0 va:data-open:zoom-in-95 va:data-closed:animate-out va:data-closed:fade-out-0 va:data-closed:zoom-out-95", l),
          ...v
        }
      )
    }
  ) });
}
function _4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    cw,
    {
      "data-slot": "combobox-list",
      className: $e(
        "va:no-scrollbar va:max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] va:scroll-py-1 va:overflow-y-auto va:overscroll-contain va:p-1 va:data-empty:p-0",
        l
      ),
      ...i
    }
  );
}
function j4({
  className: l,
  children: i,
  ...r
}) {
  return /* @__PURE__ */ w.jsxs(
    Gw,
    {
      "data-slot": "combobox-item",
      className: $e(
        "va:relative va:flex va:w-full va:cursor-default va:items-center va:gap-2 va:rounded-md va:py-1 va:pr-8 va:pl-1.5 va:text-sm va:outline-hidden va:select-none va:data-highlighted:bg-accent va:data-highlighted:text-accent-foreground va:not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground va:data-disabled:pointer-events-none va:data-disabled:opacity-50 va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
        l
      ),
      ...r,
      children: [
        i,
        /* @__PURE__ */ w.jsx(
          $w,
          {
            render: /* @__PURE__ */ w.jsx("span", { className: "va:pointer-events-none va:absolute va:right-2 va:flex va:size-4 va:items-center va:justify-center" }),
            children: /* @__PURE__ */ w.jsx(vy, { className: "va:pointer-events-none" })
          }
        )
      ]
    }
  );
}
function H4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    Uw,
    {
      "data-slot": "combobox-group",
      className: $e(l),
      ...i
    }
  );
}
function U4({
  className: l,
  ...i
}) {
  return /* @__PURE__ */ w.jsx(
    Iw,
    {
      "data-slot": "combobox-label",
      className: $e("va:px-2 va:py-1.5 va:text-xs va:text-muted-foreground", l),
      ...i
    }
  );
}
function I4({ ...l }) {
  return /* @__PURE__ */ w.jsx(o1, { "data-slot": "combobox-collection", ...l });
}
function V4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    Yw,
    {
      "data-slot": "combobox-empty",
      className: $e(
        "va:hidden va:w-full va:justify-center va:py-2 va:text-center va:text-sm va:text-muted-foreground va:group-data-empty/combobox-content:flex",
        l
      ),
      ...i
    }
  );
}
function L4({ ...l }) {
  return /* @__PURE__ */ w.jsx(t4, { "data-slot": "dialog", ...l });
}
function B4({ ...l }) {
  return /* @__PURE__ */ w.jsx(TO, { "data-slot": "dialog-trigger", ...l });
}
function q4({ ...l }) {
  return /* @__PURE__ */ w.jsx(SO, { "data-slot": "dialog-portal", ...l });
}
function G4({
  className: l,
  ...i
}) {
  return /* @__PURE__ */ w.jsx(
    dO,
    {
      "data-slot": "dialog-overlay",
      className: $e(
        "voxel-armory-overlay va:fixed va:inset-0 va:isolate va:z-50 va:bg-background/80 va:duration-100 va:supports-backdrop-filter:backdrop-blur-xs va:data-open:animate-in va:data-open:fade-in-0 va:data-closed:animate-out va:data-closed:fade-out-0",
        l
      ),
      ...i
    }
  );
}
function Y4({
  className: l,
  children: i,
  showCloseButton: r = !0,
  variant: s = "default",
  portalContainer: c,
  ...f
}) {
  return /* @__PURE__ */ w.jsxs(q4, { container: c, children: [
    /* @__PURE__ */ w.jsx(G4, {}),
    /* @__PURE__ */ w.jsxs(
      xO,
      {
        "data-slot": "dialog-content",
        "data-variant": s,
        className: $e(
          "va:fixed va:top-1/2 va:left-1/2 va:z-50 va:grid va:w-full va:max-w-[calc(100%-2rem)] va:-translate-x-1/2 va:-translate-y-1/2 va:gap-4 va:rounded-xl va:bg-popover va:p-4 va:text-sm va:text-popover-foreground va:ring-1 va:ring-foreground/10 va:duration-100 va:outline-none va:sm:max-w-sm va:data-open:animate-in va:data-open:fade-in-0 va:data-open:zoom-in-95 va:data-closed:animate-out va:data-closed:fade-out-0 va:data-closed:zoom-out-95",
          s === "armory" && "voxel-armory-modal",
          l
        ),
        ...f,
        children: [
          i,
          r && /* @__PURE__ */ w.jsxs(
            I2,
            {
              "data-slot": "dialog-close",
              render: /* @__PURE__ */ w.jsx(
                za,
                {
                  variant: "ghost",
                  className: "va:absolute va:top-2 va:right-2",
                  size: "icon-sm"
                }
              ),
              children: [
                /* @__PURE__ */ w.jsx(
                  c0,
                  {}
                ),
                /* @__PURE__ */ w.jsx("span", { className: "va:sr-only", children: "Close" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function k4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "dialog-header",
      className: $e("va:flex va:flex-col va:gap-2", l),
      ...i
    }
  );
}
function X4({
  className: l,
  showCloseButton: i = !1,
  children: r,
  ...s
}) {
  return /* @__PURE__ */ w.jsxs(
    "div",
    {
      "data-slot": "dialog-footer",
      className: $e(
        "va:-mx-4 va:-mb-4 va:flex va:flex-col-reverse va:gap-2 va:rounded-b-xl va:border-t va:bg-muted/50 va:p-4 va:sm:flex-row va:sm:justify-end",
        l
      ),
      ...s,
      children: [
        r,
        i && /* @__PURE__ */ w.jsx(I2, { render: /* @__PURE__ */ w.jsx(za, { variant: "outline" }), children: "Close" })
      ]
    }
  );
}
function K4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    EO,
    {
      "data-slot": "dialog-title",
      className: $e(
        "va:text-base va:leading-none va:font-medium",
        l
      ),
      ...i
    }
  );
}
function P4({
  className: l,
  ...i
}) {
  return /* @__PURE__ */ w.jsx(
    mO,
    {
      "data-slot": "dialog-description",
      className: $e(
        "va:text-sm va:text-muted-foreground va:*:[a]:underline va:*:[a]:underline-offset-3 va:*:[a]:hover:text-foreground",
        l
      ),
      ...i
    }
  );
}
function ty({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "empty",
      className: $e(
        "va:flex va:w-full va:min-w-0 va:flex-1 va:flex-col va:items-center va:justify-center va:gap-4 va:rounded-xl va:border-dashed va:p-6 va:text-center va:text-balance",
        l
      ),
      ...i
    }
  );
}
function ny({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "empty-header",
      className: $e("va:flex va:max-w-sm va:flex-col va:items-center va:gap-2", l),
      ...i
    }
  );
}
function ly({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "empty-title",
      className: $e(
        "va: va:text-sm va:font-medium va:tracking-tight",
        l
      ),
      ...i
    }
  );
}
function ay({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "empty-description",
      className: $e(
        "va:text-sm/relaxed va:text-muted-foreground va:[&>a]:underline va:[&>a]:underline-offset-4 va:[&>a:hover]:text-primary",
        l
      ),
      ...i
    }
  );
}
function Q4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "empty-content",
      className: $e(
        "va:flex va:w-full va:max-w-sm va:min-w-0 va:flex-col va:items-center va:gap-2.5 va:text-sm va:text-balance",
        l
      ),
      ...i
    }
  );
}
function Z4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "label",
    {
      "data-slot": "label",
      className: $e(
        "va:flex va:items-center va:gap-2 va:text-sm va:leading-none va:font-medium va:select-none va:group-data-[disabled=true]:pointer-events-none va:group-data-[disabled=true]:opacity-50 va:peer-disabled:cursor-not-allowed va:peer-disabled:opacity-50",
        l
      ),
      ...i
    }
  );
}
function F4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "fieldset",
    {
      "data-slot": "field-set",
      className: $e(
        "va:flex va:flex-col va:gap-4 va:has-[>[data-slot=checkbox-group]]:gap-3 va:has-[>[data-slot=radio-group]]:gap-3",
        l
      ),
      ...i
    }
  );
}
function J4({
  className: l,
  variant: i = "legend",
  ...r
}) {
  return /* @__PURE__ */ w.jsx(
    "legend",
    {
      "data-slot": "field-legend",
      "data-variant": i,
      className: $e(
        "va:mb-1.5 va:font-medium va:data-[variant=label]:text-sm va:data-[variant=legend]:text-base",
        l
      ),
      ...r
    }
  );
}
function s0({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      "data-slot": "field-group",
      className: $e(
        "va:group/field-group va:@container/field-group va:flex va:w-full va:flex-col va:gap-5 va:data-[slot=checkbox-group]:gap-3 va:*:data-[slot=field-group]:gap-4",
        l
      ),
      ...i
    }
  );
}
const $4 = Ar(
  "va:group/field va:flex va:w-full va:gap-2 va:data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "va:flex-col va:*:w-full va:[&>.sr-only]:w-auto",
        horizontal: "va:flex-row va:items-center va:has-[>[data-slot=field-content]]:items-start va:*:data-[slot=field-label]:flex-auto va:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive: "va:flex-col va:*:w-full va:@md/field-group:flex-row va:@md/field-group:items-center va:@md/field-group:*:w-auto va:@md/field-group:has-[>[data-slot=field-content]]:items-start va:@md/field-group:*:data-[slot=field-label]:flex-auto va:[&>.sr-only]:w-auto va:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px"
      }
    },
    defaultVariants: {
      orientation: "vertical"
    }
  }
);
function Rc({
  className: l,
  orientation: i = "vertical",
  ...r
}) {
  return /* @__PURE__ */ w.jsx(
    "div",
    {
      role: "group",
      "data-slot": "field",
      "data-orientation": i,
      className: $e($4({ orientation: i }), l),
      ...r
    }
  );
}
function Tc({
  className: l,
  ...i
}) {
  return /* @__PURE__ */ w.jsx(
    Z4,
    {
      "data-slot": "field-label",
      className: $e(
        "va:group/field-label va:peer/field-label va:flex va:w-fit va:gap-2 va:leading-snug va:group-data-[disabled=true]/field:opacity-50 va:has-data-checked:border-primary/30 va:has-data-checked:bg-primary/5 va:has-[>[data-slot=field]]:rounded-lg va:has-[>[data-slot=field]]:border va:has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 va:has-[>[data-slot=field]]:has-[:focus-visible]:border-ring va:has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 va:has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 va:*:data-[slot=field]:p-2.5 va:dark:has-data-checked:border-primary/20 va:dark:has-data-checked:bg-primary/10",
        "va:has-[>[data-slot=field]]:w-full va:has-[>[data-slot=field]]:flex-col",
        l
      ),
      ...i
    }
  );
}
function W4({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    p4,
    {
      "data-slot": "radio-group",
      className: $e("va:grid va:w-full va:gap-2", l),
      ...i
    }
  );
}
function e3({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    m4,
    {
      "data-slot": "radio-group-item",
      className: $e(
        "va:group/radio-group-item va:peer va:relative va:flex va:aspect-square va:size-4 va:shrink-0 va:rounded-full va:border va:border-input va:outline-none va:group-has-[:focus-visible]/field-label:ring-0 va:group-has-[:focus-visible]/field-label:not-data-checked:border-input va:after:absolute va:after:-inset-x-3 va:after:-inset-y-2 va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:cursor-not-allowed va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:aria-invalid:aria-checked:border-primary va:dark:bg-input/30 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40 va:data-checked:border-primary va:data-checked:bg-primary va:data-checked:text-primary-foreground va:group-has-[:focus-visible]/field-label:data-checked:border-primary va:dark:data-checked:bg-primary",
        l
      ),
      ...i,
      children: /* @__PURE__ */ w.jsx(
        g4,
        {
          "data-slot": "radio-group-indicator",
          className: "va:flex va:size-4 va:items-center va:justify-center",
          children: /* @__PURE__ */ w.jsx("span", { className: "va:absolute va:top-1/2 va:left-1/2 va:size-2 va:-translate-x-1/2 va:-translate-y-1/2 va:rounded-full va:bg-primary-foreground" })
        }
      )
    }
  );
}
function t3({
  className: l,
  orientation: i = "horizontal",
  ...r
}) {
  return /* @__PURE__ */ w.jsx(
    b4,
    {
      "data-slot": "tabs",
      "data-orientation": i,
      orientation: i,
      className: $e(
        "va:group/tabs va:flex va:gap-2 va:data-[orientation=horizontal]:flex-col",
        l
      ),
      ...r
    }
  );
}
const n3 = Ar(
  "va:group/tabs-list va:inline-flex va:w-fit va:items-center va:justify-center va:rounded-lg va:p-[3px] va:text-muted-foreground va:group-data-[orientation=horizontal]/tabs:h-8 va:group-data-[orientation=vertical]/tabs:h-fit va:group-data-[orientation=vertical]/tabs:flex-col va:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "va:bg-muted",
        armory: "armory-tabs-list va:bg-transparent",
        line: "va:gap-1 va:bg-transparent"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function l3({
  className: l,
  variant: i = "default",
  ...r
}) {
  return /* @__PURE__ */ w.jsx(
    R4,
    {
      "data-slot": "tabs-list",
      "data-variant": i,
      className: $e(n3({ variant: i }), l),
      ...r
    }
  );
}
function a3({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    x4,
    {
      "data-slot": "tabs-trigger",
      className: $e(
        "va:relative va:inline-flex va:h-[calc(100%-1px)] va:flex-1 va:items-center va:justify-center va:gap-1.5 va:rounded-md va:border va:border-transparent va:px-1.5 va:py-0.5 va:text-sm va:font-medium va:whitespace-nowrap va:text-foreground/60 va:transition-all va:group-data-[orientation=vertical]/tabs:w-full va:group-data-[orientation=vertical]/tabs:justify-start va:hover:text-foreground va:focus-visible:border-ring va:focus-visible:ring-[3px] va:focus-visible:ring-ring/50 va:focus-visible:outline-1 va:focus-visible:outline-ring va:disabled:pointer-events-none va:disabled:opacity-50 va:has-data-[icon=inline-end]:pr-1 va:has-data-[icon=inline-start]:pl-1 va:aria-disabled:pointer-events-none va:aria-disabled:opacity-50 va:dark:text-muted-foreground va:dark:hover:text-foreground va:group-data-[variant=default]/tabs-list:data-active:shadow-sm va:group-data-[variant=line]/tabs-list:data-active:shadow-none va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
        "va:group-data-[variant=line]/tabs-list:bg-transparent va:group-data-[variant=line]/tabs-list:data-active:bg-transparent va:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent va:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "va:data-active:bg-background va:data-active:text-foreground va:dark:data-active:border-input va:dark:data-active:bg-input/30 va:dark:data-active:text-foreground",
        "va:after:absolute va:after:bg-foreground va:after:opacity-0 va:after:transition-opacity va:group-data-[orientation=horizontal]/tabs:after:inset-x-0 va:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] va:group-data-[orientation=horizontal]/tabs:after:h-0.5 va:group-data-[orientation=vertical]/tabs:after:inset-y-0 va:group-data-[orientation=vertical]/tabs:after:-right-1 va:group-data-[orientation=vertical]/tabs:after:w-0.5 va:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        l
      ),
      ...i
    }
  );
}
function i3({ className: l, ...i }) {
  return /* @__PURE__ */ w.jsx(
    C4,
    {
      "data-slot": "tabs-content",
      className: $e("va:flex-1 va:text-sm va:outline-none", l),
      ...i
    }
  );
}
const C1 = Object.freeze([
  { id: "all", label: "All weapons" },
  { id: "sidearm", label: "Sidearms" },
  { id: "smg", label: "SMGs" },
  { id: "shotgun", label: "Shotguns" },
  { id: "rifle", label: "Rifles" },
  { id: "sniper", label: "Sniper rifles" },
  { id: "heavy", label: "Machine guns" },
  { id: "special", label: "Special" }
]), o3 = Object.freeze([
  { id: "all", label: "All weapons" },
  { id: "blades", label: "Blades" },
  { id: "impact", label: "Impact" }
]), iy = Object.freeze({
  carbine: "rifle",
  smg: "smg",
  marksman: "sniper",
  pistol: "sidearm",
  shotgun: "shotgun",
  burst: "rifle",
  sniper: "sniper",
  lmg: "heavy",
  crossbow: "special",
  revolver: "sidearm",
  pdw: "smg",
  autoshotgun: "shotgun",
  battlerifle: "rifle",
  dualpistols: "sidearm",
  dualsmg: "smg",
  slugshotgun: "shotgun"
}), R1 = (l) => l === "melee" ? o3 : C1, T1 = (l) => l === "melee" ? uE : iE, Er = (l) => `${l.toFixed(2)} s`, r3 = (l) => String(Number(l.toFixed(2))), Da = (l, i, r = "") => ({ label: l, value: String(i), note: r });
function u3(l, i = "gun") {
  const r = T1(i), s = typeof l == "string" ? Object.hasOwn(r, l) ? r[l] : null : l, c = s?.id ?? (typeof l == "string" ? l : "");
  return i === "melee" ? ["axe", "tonfas"].includes(c) ? "impact" : "blades" : C1.some((f) => f.id !== "all" && f.id === s?.category) ? s.category : Object.hasOwn(iy, c) ? iy[c] : "special";
}
function s3(l) {
  const i = lE(l);
  if (!i) return [];
  const r = i.pellets > 1, s = r ? `Body damage per pellet · ${i.pellets} pellets per shell · close range` : "Body hit · close range", c = r ? "shells" : l.projectile ? "bolts" : "rounds", f = l.projectile ? "Includes reload between bolts" : i.windupSeconds ? `${Er(i.windupSeconds)} wind-up` : i.mode === "burst" ? "Includes burst recovery" : "", m = Number.isFinite(i.emptyReloadSeconds) && i.emptyReloadSeconds !== i.reloadSeconds ? `${Er(i.emptyReloadSeconds)} when empty` : "";
  return [
    Da("Damage", aE(l, "body", 0), s),
    Da("Magazine", l.magazine, `${c} · ${l.reserve} in reserve`),
    Da("Fire rate", i.fireRateLabel, f),
    Da("Reload", Er(i.reloadSeconds), m)
  ];
}
function c3(l) {
  const i = oE(l.id), r = rE({ meleeWeapon: l.id, meleeAction: "primary", meleeComboWeapon: l.id, meleeComboStep: i });
  return [
    Da("Damage", l.damage, "Opening strike"),
    Da("Reach", `${r3(l.reach)} m`, "Primary strike"),
    Da("Wind-up", Er(l.startupTicks / 120), "Before the strike becomes active"),
    Da("Swing", Er((l.startupTicks + l.activeTicks + l.recoveryTicks) / 120), "Full swing and recovery"),
    Da("Combo", `${i} hits`, `Confirm each hit · ${Er(sE / 120)} after recovery to follow up`),
    Da("Finisher", r.damage, "Last confirmed cut · stronger push and brief stagger; enemies can resist")
  ];
}
function f3(l, i = "gun") {
  const r = T1(i), s = /* @__PURE__ */ new Set();
  return Array.from(l?.options ?? []).flatMap((c) => {
    const f = String(c.value ?? "");
    if (!f || s.has(f)) return [];
    s.add(f);
    const m = Object.hasOwn(r, f) ? r[f] : null, v = m?.name || String(c.label || c.textContent || c.text || f).trim() || f, y = u3(m ?? f, i), h = c.closest?.("optgroup") ?? (c.parentElement?.tagName === "OPTGROUP" ? c.parentElement : null);
    return [{
      id: f,
      name: v,
      label: m?.label || v,
      category: y,
      categoryLabel: R1(i).find((p) => p.id === y)?.label || "Special",
      description: m?.description || "",
      image: `art/armory/${i === "melee" ? "melee_" : ""}${encodeURIComponent(f)}.webp`,
      disabled: !!(l.disabled || c.disabled || h?.disabled),
      weapon: m,
      stats: m ? i === "melee" ? c3(m) : s3(m) : []
    }];
  });
}
function A1(l, i = "gun") {
  return R1(i).flatMap((r) => {
    const s = r.id === "all" ? l.length : l.filter((c) => c.category === r.id).length;
    return r.id === "all" || s ? [{ ...r, count: s }] : [];
  });
}
function O1(l, i = "all", r = "") {
  const s = String(r ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return l.filter((c) => {
    if (i && i !== "all" && c.category !== i) return !1;
    const f = [c.name, c.label, c.id, c.categoryLabel, c.description].join(" ").toLocaleLowerCase();
    return s.every((m) => f.includes(m));
  });
}
const oy = Object.freeze({
  "carbine.webp": [
    640,
    360,
    164,
    105,
    479,
    249
  ],
  "smg.webp": [
    640,
    360,
    195,
    110,
    449,
    245
  ],
  "marksman.webp": [
    640,
    360,
    147,
    114,
    493,
    267
  ],
  "pistol.webp": [
    640,
    360,
    261,
    127,
    381,
    237
  ],
  "shotgun.webp": [
    640,
    360,
    150,
    113,
    491,
    246
  ],
  "burst.webp": [
    640,
    360,
    169,
    106,
    473,
    251
  ],
  "sniper.webp": [
    640,
    360,
    105,
    114,
    529,
    272
  ],
  "lmg.webp": [
    640,
    360,
    153,
    103,
    509,
    261
  ],
  "crossbow.webp": [
    640,
    360,
    152,
    120,
    464,
    245
  ],
  "revolver.webp": [
    640,
    360,
    245,
    124,
    396,
    240
  ],
  "pdw.webp": [
    640,
    360,
    188,
    118,
    455,
    251
  ],
  "autoshotgun.webp": [
    640,
    360,
    155,
    97,
    491,
    255
  ],
  "battlerifle.webp": [
    640,
    360,
    129,
    101,
    512,
    256
  ],
  "dualpistols.webp": [
    640,
    360,
    238,
    120,
    403,
    244
  ],
  "dualsmg.webp": [
    640,
    360,
    220,
    109,
    424,
    248
  ],
  "slugshotgun.webp": [
    640,
    360,
    130,
    110,
    511,
    246
  ],
  "classic.webp": [
    640,
    360,
    262,
    125,
    380,
    236
  ],
  "shorty.webp": [
    640,
    360,
    247,
    125,
    390,
    237
  ],
  "frenzy.webp": [
    640,
    360,
    255,
    110,
    388,
    252
  ],
  "ghost.webp": [
    640,
    360,
    217,
    117,
    423,
    245
  ],
  "sheriff.webp": [
    640,
    360,
    236,
    123,
    404,
    239
  ],
  "bandit.webp": [
    640,
    360,
    246,
    117,
    395,
    246
  ],
  "stinger.webp": [
    640,
    360,
    197,
    103,
    450,
    245
  ],
  "spectre.webp": [
    640,
    360,
    163,
    100,
    482,
    249
  ],
  "bucky.webp": [
    640,
    360,
    144,
    111,
    498,
    243
  ],
  "judge.webp": [
    640,
    360,
    157,
    95,
    489,
    256
  ],
  "bulldog.webp": [
    640,
    360,
    177,
    105,
    471,
    256
  ],
  "guardian.webp": [
    640,
    360,
    123,
    101,
    519,
    246
  ],
  "phantom.webp": [
    640,
    360,
    124,
    96,
    517,
    252
  ],
  "vandal.webp": [
    640,
    360,
    133,
    89,
    515,
    255
  ],
  "warden.webp": [
    640,
    360,
    112,
    106,
    528,
    270
  ],
  "marshal.webp": [
    640,
    360,
    104,
    120,
    534,
    268
  ],
  "outlaw.webp": [
    640,
    360,
    118,
    118,
    518,
    263
  ],
  "operator.webp": [
    640,
    360,
    63,
    109,
    573,
    275
  ],
  "ares.webp": [
    640,
    360,
    133,
    98,
    514,
    264
  ],
  "odin.webp": [
    640,
    360,
    101,
    84,
    558,
    274
  ],
  "melee_knife.webp": [
    640,
    360,
    232,
    158,
    409,
    210
  ],
  "melee_sword.webp": [
    640,
    360,
    133,
    140,
    509,
    250
  ],
  "melee_katana.webp": [
    640,
    360,
    95,
    122,
    550,
    237
  ],
  "melee_axe.webp": [
    640,
    360,
    132,
    88,
    496,
    230
  ],
  "melee_tonfas.webp": [
    640,
    360,
    172,
    86,
    469,
    260
  ]
});
function d3(l) {
  const i = String(l || "").split("/").at(-1);
  if (!Object.hasOwn(oy, i)) return;
  const [r, s, c, f, m, v] = oy[i], y = m - c, h = v - f, p = Math.min(44 / y, 28 / h);
  return {
    width: `${r * p}px`,
    height: `${s * p}px`,
    left: `calc(50% - ${(c + y / 2) * p}px)`,
    top: `calc(50% - ${(f + h / 2) * p}px)`
  };
}
const m3 = (l) => l.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || l, ry = (l, i) => {
  if (i === "melee") return l.stats[1] ? `${l.stats[1].value} reach · ${l.stats[0].value} damage` : l.categoryLabel;
  if (!l.weapon) return l.categoryLabel;
  const r = l.weapon.projectile ? "bolts" : l.weapon.pellets || l.category === "shotgun" ? "shells" : "rounds", s = l.weapon.projectile ? "Projectile" : l.weapon.mode === "burst" ? "Burst" : !l.weapon.mode || l.weapon.mode === "auto" ? "Automatic" : l.weapon.mode === "pump" ? "Pump action" : l.weapon.mode === "bolt" ? "Bolt action" : "Single fire";
  return `${l.weapon.magazine} ${r} · ${s}`;
};
function Ac({ entry: l, hero: i = !1, eager: r = !1, icon: s = !1 }) {
  const [c, f] = b.useState(!1), m = s ? d3(l.image) : void 0;
  return b.useEffect(() => f(!1), [l.image]), c ? /* @__PURE__ */ w.jsx("span", { className: "armory-image-fallback", children: l.label }) : /* @__PURE__ */ w.jsx("img", { src: l.image, alt: "", className: $e("armory-weapon-image", i && "armory-weapon-image-hero"), "data-armory-cropped-icon": !!m || void 0, style: m, loading: i || r ? "eager" : "lazy", draggable: !1, onError: () => f(!0) });
}
function g3({ entry: l, kind: i }) {
  const r = b.useRef(null), s = b.useRef(null), c = b.useRef(l.id), [f, m] = b.useState(!1), [v, y] = b.useState(!1);
  return c.current = l.id, b.useEffect(() => {
    let h = !1;
    return m(!1), y(!1), import("./voxel-armory-preview.js").then(async ({ createWeaponPreview: p }) => {
      if (h || !r.current) return;
      const g = await p(r.current, {
        weaponId: c.current,
        kind: i,
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
        onError: () => {
          h || (m(!1), y(!0));
        }
      });
      if (h) {
        g.destroy();
        return;
      }
      s.current = g, g.setWeapon(c.current, i), m(!0);
    }).catch(() => {
      h || y(!0);
    }), () => {
      h = !0, s.current?.destroy(), s.current = null;
    };
  }, [i]), b.useEffect(() => {
    s.current?.setWeapon(l.id, i);
  }, [l.id, i]), /* @__PURE__ */ w.jsxs("div", { className: "armory-inspection", children: [
    /* @__PURE__ */ w.jsxs("div", { className: "armory-hero-stage", "data-preview-ready": f, children: [
      /* @__PURE__ */ w.jsx("div", { className: "armory-hero-grid", "aria-hidden": "true" }),
      /* @__PURE__ */ w.jsx("div", { className: "armory-hero-caption", "aria-hidden": "true", children: i === "melee" ? "CLOSE QUARTERS" : "WEAPON INSPECTION" }),
      !f && /* @__PURE__ */ w.jsx(Ac, { entry: l, hero: !0 }),
      /* @__PURE__ */ w.jsx("canvas", { ref: r, "data-armory-preview": !0, tabIndex: f ? 0 : -1, "aria-hidden": !f, "aria-label": `Inspect ${l.name}. Drag or use arrow keys to rotate. Home resets.` }),
      /* @__PURE__ */ w.jsx(vr, { variant: "outline", className: "armory-preview-badge", children: f ? "3D model" : v ? "Weapon model" : "Loading 3D" })
    ] }),
    /* @__PURE__ */ w.jsxs("div", { className: "armory-inspection-tools", children: [
      /* @__PURE__ */ w.jsx("span", { children: f ? "Drag to rotate · arrow keys when focused" : "Actual in-game weapon model" }),
      f && /* @__PURE__ */ w.jsxs(za, { variant: "ghost", size: "sm", "aria-label": "Reset weapon preview", "data-armory-action": "reset-preview", onClick: () => s.current?.reset(), children: [
        /* @__PURE__ */ w.jsx(cC, { "data-icon": "inline-start" }),
        "Reset"
      ] })
    ] })
  ] });
}
function uy({ entry: l }) {
  return l.stats.length ? /* @__PURE__ */ w.jsx("dl", { className: "armory-stats", children: l.stats.map((i) => /* @__PURE__ */ w.jsxs("div", { className: "armory-stat", children: [
    /* @__PURE__ */ w.jsx("dt", { children: i.label }),
    /* @__PURE__ */ w.jsx("dd", { children: i.value }),
    i.note && /* @__PURE__ */ w.jsx("span", { children: i.note })
  ] }, i.label)) }) : null;
}
function h3({ snapshot: l, kind: i, entry: r, disabled: s, open: c, onOpenChange: f, onCommit: m, triggerRef: v, portalContainer: y }) {
  const h = b.useId(), p = A1(l.entries, i).filter((x) => x.id !== "all").map((x) => ({
    value: x.id,
    label: x.label,
    items: l.entries.filter((T) => T.category === x.id)
  })), g = (x) => x.stopPropagation();
  return /* @__PURE__ */ w.jsx(s0, { className: "armory-quick-field", children: /* @__PURE__ */ w.jsxs(Rc, { "data-disabled": s || void 0, children: [
    /* @__PURE__ */ w.jsxs(Tc, { htmlFor: `${h}-trigger`, className: "va:sr-only", children: [
      "Choose ",
      i === "melee" ? "melee weapon" : "gun"
    ] }),
    /* @__PURE__ */ w.jsxs(
      M4,
      {
        items: p,
        value: r || null,
        open: c,
        disabled: s,
        onOpenChange: f,
        itemToStringLabel: (x) => x.name,
        itemToStringValue: (x) => x.id,
        isItemEqualToValue: (x, T) => x.id === T.id,
        filter: (x, T) => O1([x], "all", T).length > 0,
        onValueChange: (x, T) => {
          if (T.reason !== "item-press" || !x) {
            T.cancel();
            return;
          }
          m(x.id) ? f(!1) : T.cancel();
        },
        children: [
          /* @__PURE__ */ w.jsxs(
            E1,
            {
              ref: v,
              id: `${h}-trigger`,
              render: /* @__PURE__ */ w.jsx(za, { variant: "outline" }),
              className: "armory-quick-trigger",
              "data-armory-action": "quick-open",
              "aria-label": `Choose ${i === "melee" ? "melee weapon" : "gun"}${r ? `, selected ${r.name}` : ""}`,
              onKeyDown: g,
              onKeyUp: g,
              children: [
                /* @__PURE__ */ w.jsx("span", { className: "armory-quick-thumbnail", "aria-hidden": "true", children: r && /* @__PURE__ */ w.jsx(Ac, { entry: r, eager: !0, icon: !0 }) }),
                /* @__PURE__ */ w.jsxs("span", { className: "armory-quick-copy", children: [
                  /* @__PURE__ */ w.jsx("strong", { className: "va:truncate", children: r?.name || "Choose your weapon" }),
                  /* @__PURE__ */ w.jsx("span", { className: "va:truncate", children: r ? ry(r, i) : "Explore your equipment" })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ w.jsxs(
            z4,
            {
              portalContainer: y,
              className: "voxel-armory-picker-popup",
              "data-voxel-armory": "",
              "data-armory-picker": "",
              "aria-label": i === "melee" ? "Melee weapon picker" : "Gun picker",
              onKeyDown: g,
              onKeyUp: g,
              children: [
                /* @__PURE__ */ w.jsx(s0, { className: "armory-quick-search-field", children: /* @__PURE__ */ w.jsxs(Rc, { children: [
                  /* @__PURE__ */ w.jsx(Tc, { htmlFor: `${h}-search`, className: "va:sr-only", children: "Search weapons" }),
                  /* @__PURE__ */ w.jsx(D4, { id: `${h}-search`, showTrigger: !1, placeholder: "Search weapons…", autoComplete: "off", "data-armory-quick-search": !0, children: /* @__PURE__ */ w.jsx(x1, { children: /* @__PURE__ */ w.jsx(Ry, { "aria-hidden": "true" }) }) })
                ] }) }),
                /* @__PURE__ */ w.jsx(V4, { className: "armory-quick-empty", children: "No weapons found. Try another name." }),
                /* @__PURE__ */ w.jsx(_4, { className: "armory-quick-list", children: (x) => /* @__PURE__ */ w.jsxs(H4, { items: x.items, children: [
                  /* @__PURE__ */ w.jsx(U4, { className: "armory-quick-group-label", children: x.label }),
                  /* @__PURE__ */ w.jsx(I4, { children: (T) => /* @__PURE__ */ w.jsxs(
                    j4,
                    {
                      value: T,
                      disabled: T.disabled,
                      className: "armory-quick-item",
                      "data-weapon-id": T.id,
                      children: [
                        /* @__PURE__ */ w.jsx("span", { className: "armory-quick-thumbnail", "aria-hidden": "true", children: /* @__PURE__ */ w.jsx(Ac, { entry: T, eager: !0, icon: !0 }) }),
                        /* @__PURE__ */ w.jsxs("span", { className: "armory-quick-copy", children: [
                          /* @__PURE__ */ w.jsx("strong", { className: "va:truncate", children: T.name }),
                          /* @__PURE__ */ w.jsx("span", { className: "va:truncate", children: ry(T, i) })
                        ] })
                      ]
                    },
                    T.id
                  ) })
                ] }, x.value) }),
                /* @__PURE__ */ w.jsxs("div", { className: "armory-quick-help", children: [
                  /* @__PURE__ */ w.jsx("span", { children: "↑ ↓ browse · Enter choose" }),
                  /* @__PURE__ */ w.jsx("span", { children: "Esc close" })
                ] })
              ]
            }
          )
        ]
      }
    )
  ] }) });
}
function p3({ snapshot: l, entry: i, kind: r, disabled: s, triggerRef: c, quickTriggerRef: f, quickOpen: m, onQuickOpenChange: v, onCommit: y, portalContainer: h }) {
  return /* @__PURE__ */ w.jsxs(E0, { variant: "loadout", size: "sm", children: [
    /* @__PURE__ */ w.jsxs(C0, { children: [
      /* @__PURE__ */ w.jsx(mc, { children: r === "melee" ? "Melee weapon" : "Starting gun" }),
      /* @__PURE__ */ w.jsx(R0, { className: "va:sr-only", children: i?.name || "Choose your weapon" })
    ] }),
    /* @__PURE__ */ w.jsx(T0, { children: /* @__PURE__ */ w.jsx(h3, { snapshot: l, entry: i, kind: r, disabled: s, open: m, onOpenChange: v, onCommit: y, triggerRef: f, portalContainer: h }) }),
    /* @__PURE__ */ w.jsxs(A0, { children: [
      /* @__PURE__ */ w.jsxs("span", { className: "armory-loadout-facts", children: [
        i?.categoryLabel || "Explore the armory",
        " · inspect models & stats"
      ] }),
      /* @__PURE__ */ w.jsxs(B4, { ref: c, render: /* @__PURE__ */ w.jsx(za, { variant: "outline", size: "sm", "data-armory-action": "open", disabled: s }), "aria-label": `Open ${r === "melee" ? "melee " : ""}armory${i ? `, equipped ${i.name}` : ""}`, children: [
        "Armory",
        /* @__PURE__ */ w.jsx(sC, { "data-icon": "inline-end" })
      ] })
    ] })
  ] });
}
function v3({ entry: l, selected: i, equipped: r, choiceId: s }) {
  const c = l.stats[0];
  return /* @__PURE__ */ w.jsx(Rc, { "data-disabled": l.disabled || void 0, className: "armory-choice", children: /* @__PURE__ */ w.jsx(Tc, { htmlFor: s, className: "armory-choice-label", children: /* @__PURE__ */ w.jsxs(E0, { variant: "weapon", size: "sm", className: "armory-tile", "data-selected": i, "data-equipped": r, "data-entry-id": l.id, children: [
    /* @__PURE__ */ w.jsxs(C0, { children: [
      /* @__PURE__ */ w.jsx(mc, { children: l.label === l.name.toUpperCase() ? l.categoryLabel : l.label.toLowerCase() }),
      /* @__PURE__ */ w.jsx(R0, { children: l.name })
    ] }),
    /* @__PURE__ */ w.jsx(T0, { children: /* @__PURE__ */ w.jsx("div", { className: "armory-thumbnail-stage", children: /* @__PURE__ */ w.jsx(Ac, { entry: l, eager: !0 }) }) }),
    /* @__PURE__ */ w.jsxs(A0, { children: [
      /* @__PURE__ */ w.jsx("span", { children: r ? /* @__PURE__ */ w.jsxs(vr, { variant: "secondary", children: [
        /* @__PURE__ */ w.jsx(vy, { "data-icon": "inline-start" }),
        "Equipped"
      ] }) : c ? `${c.value} ${l.weapon?.pellets ? "per pellet" : "damage"}` : l.categoryLabel }),
      /* @__PURE__ */ w.jsx(e3, { id: s, value: l.id, disabled: l.disabled, "aria-label": `Preview ${l.name}`, "data-weapon-id": l.id })
    ] })
  ] }) }) });
}
function b3({ snapshot: l, kind: i, title: r, portalContainer: s, onCommit: c, commandRef: f }) {
  const m = b.useId(), v = b.useRef(null), y = b.useRef(null), [h, p] = b.useState(!1), [g, x] = b.useState(!1), [T, A] = b.useState(l.value), [N, E] = b.useState("all"), [M, R] = b.useState(""), I = l.entries.find((j) => j.id === l.value), C = l.entries.find((j) => j.id === T), z = A1(l.entries, i), V = O1(l.entries, N, M);
  b.useImperativeHandle(f, () => ({ close: () => {
    p(!1), x(!1);
  }, isOpen: () => h || g, focus: () => y.current?.focus() }), [h, g]), b.useEffect(() => {
    h || A(l.value), (l.disabled || !l.entries.some((j) => !j.disabled)) && (p(!1), x(!1));
  }, [l.value, l.disabled, l.entries, h]), b.useEffect(() => {
    z.some((j) => j.id === N) || E("all"), T && !l.entries.some((j) => j.id === T) && A(l.value);
  }, [l.entries, N, T, l.value]);
  const _ = (j) => {
    j && l.disabled || (j && (x(!1), A(l.value), E("all"), R("")), p(j));
  }, U = (j) => {
    j && (l.disabled || !l.entries.some((H) => !H.disabled)) || (j && p(!1), x(j));
  };
  return /* @__PURE__ */ w.jsxs(L4, { open: h, onOpenChange: _, children: [
    /* @__PURE__ */ w.jsx(p3, { snapshot: l, triggerRef: v, quickTriggerRef: y, entry: I, kind: i, disabled: l.disabled || !l.entries.some((j) => !j.disabled), quickOpen: g, onQuickOpenChange: U, onCommit: c, portalContainer: s }),
    /* @__PURE__ */ w.jsxs(Y4, { variant: "armory", portalContainer: s, "data-voxel-armory": "", onKeyDown: (j) => {
      j.stopPropagation(), j.key === "Escape" && (j.preventDefault(), _(!1));
    }, onKeyUp: (j) => j.stopPropagation(), "data-kind": i, "data-draft-weapon": T, showCloseButton: !1, initialFocus: () => document.getElementById(`${m}-search`), children: [
      /* @__PURE__ */ w.jsx(k4, { className: "armory-dialog-header", children: /* @__PURE__ */ w.jsxs("div", { className: "armory-dialog-heading", children: [
        /* @__PURE__ */ w.jsxs("div", { className: "armory-heading-copy", children: [
          /* @__PURE__ */ w.jsxs("div", { className: "armory-eyebrow", children: [
            /* @__PURE__ */ w.jsx(fC, { "aria-hidden": "true" }),
            "THE ARMORY",
            /* @__PURE__ */ w.jsxs(vr, { variant: "outline", children: [
              l.entries.length,
              " ",
              i === "melee" ? "melee weapons" : "weapons"
            ] })
          ] }),
          /* @__PURE__ */ w.jsx(K4, { children: r }),
          /* @__PURE__ */ w.jsx(P4, { children: "Find your style. Inspect a weapon, then equip it." })
        ] }),
        /* @__PURE__ */ w.jsx(za, { variant: "ghost", size: "icon-lg", "data-armory-action": "cancel", "aria-label": "Close armory", onClick: () => _(!1), children: /* @__PURE__ */ w.jsx(c0, {}) })
      ] }) }),
      /* @__PURE__ */ w.jsxs(t3, { value: N, onValueChange: (j) => E(String(j)), className: "armory-tabs", children: [
        /* @__PURE__ */ w.jsxs("div", { className: "armory-browser-toolbar", children: [
          /* @__PURE__ */ w.jsx("div", { className: "armory-category-scroll", children: /* @__PURE__ */ w.jsx(l3, { variant: "armory", "aria-label": "Weapon categories", children: z.map((j) => /* @__PURE__ */ w.jsxs(a3, { value: j.id, "data-category": j.id, children: [
            j.label,
            /* @__PURE__ */ w.jsx("span", { className: "armory-category-count", children: j.count })
          ] }, j.id)) }) }),
          /* @__PURE__ */ w.jsx(s0, { className: "armory-search-group", children: /* @__PURE__ */ w.jsxs(Rc, { children: [
            /* @__PURE__ */ w.jsx(Tc, { htmlFor: `${m}-search`, className: "va:sr-only", children: "Search weapons" }),
            /* @__PURE__ */ w.jsxs("div", { className: "armory-search-box", children: [
              /* @__PURE__ */ w.jsx(Ry, { "aria-hidden": "true" }),
              /* @__PURE__ */ w.jsx(y1, { id: `${m}-search`, "data-armory-search": !0, type: "search", placeholder: "Search weapons…", value: M, onChange: (j) => R(j.target.value), autoComplete: "off" })
            ] })
          ] }) })
        ] }),
        /* @__PURE__ */ w.jsxs("div", { className: "armory-body", children: [
          /* @__PURE__ */ w.jsxs("div", { className: "armory-catalog", children: [
            /* @__PURE__ */ w.jsxs("div", { className: "armory-results-line", children: [
              /* @__PURE__ */ w.jsxs("span", { children: [
                V.length,
                " ",
                V.length === 1 ? "weapon" : "weapons",
                N === "all" ? " in your armory" : ` · ${z.find((j) => j.id === N)?.label}`
              ] }),
              /* @__PURE__ */ w.jsx("span", { children: "Choose to inspect" })
            ] }),
            z.map((j) => /* @__PURE__ */ w.jsx(i3, { value: j.id, hidden: N !== j.id, className: "armory-catalog-panel", children: V.length ? /* @__PURE__ */ w.jsxs(F4, { className: "armory-weapon-fieldset", children: [
              /* @__PURE__ */ w.jsxs(J4, { className: "va:sr-only", children: [
                "Choose a ",
                i === "melee" ? "melee weapon" : "gun",
                " to preview"
              ] }),
              /* @__PURE__ */ w.jsx(W4, { value: T, onValueChange: (H) => A(String(H)), className: "armory-weapon-grid", "aria-label": "Weapon preview selection", children: V.map((H) => /* @__PURE__ */ w.jsx(v3, { entry: H, selected: T === H.id, equipped: l.value === H.id, choiceId: `${m}-${j.id}-${H.id}` }, H.id)) })
            ] }) : /* @__PURE__ */ w.jsxs(ty, { className: "armory-empty", children: [
              /* @__PURE__ */ w.jsxs(ny, { children: [
                /* @__PURE__ */ w.jsx(ly, { children: "No weapons found" }),
                /* @__PURE__ */ w.jsx(ay, { children: "Try another name or weapon category." })
              ] }),
              /* @__PURE__ */ w.jsx(Q4, { children: /* @__PURE__ */ w.jsx(za, { variant: "outline", onClick: () => {
                R(""), E("all");
              }, children: "Clear filters" }) })
            ] }) }, j.id))
          ] }),
          /* @__PURE__ */ w.jsx("aside", { className: "armory-detail", "aria-label": "Selected weapon details", children: C ? /* @__PURE__ */ w.jsxs(E0, { variant: "detail", children: [
            /* @__PURE__ */ w.jsxs(C0, { children: [
              /* @__PURE__ */ w.jsxs("div", { className: "armory-detail-badges", children: [
                /* @__PURE__ */ w.jsx(vr, { variant: "outline", children: C.categoryLabel }),
                C.weapon?.valorant && /* @__PURE__ */ w.jsx(vr, { variant: "secondary", children: "VALORANT collection" }),
                l.value === C.id && /* @__PURE__ */ w.jsx(vr, { variant: "secondary", children: "Equipped" })
              ] }),
              /* @__PURE__ */ w.jsx(R0, { children: C.name }),
              /* @__PURE__ */ w.jsx(mc, { children: m3(C.description) || "Inspect the weapon before adding it to your loadout." })
            ] }),
            /* @__PURE__ */ w.jsxs(T0, { children: [
              h && /* @__PURE__ */ w.jsx(g3, { entry: C, kind: i }),
              /* @__PURE__ */ w.jsx("div", { className: "armory-desktop-stats", children: /* @__PURE__ */ w.jsx(uy, { entry: C }) }),
              /* @__PURE__ */ w.jsx(AR, { className: "armory-mobile-details", children: /* @__PURE__ */ w.jsxs(OR, { value: "details", children: [
                /* @__PURE__ */ w.jsxs(wR, { "data-armory-action": "details", children: [
                  /* @__PURE__ */ w.jsx("span", { className: "armory-mobile-only", children: "Weapon details & stats" }),
                  /* @__PURE__ */ w.jsx("span", { className: "armory-desktop-only", children: "Handling notes" })
                ] }),
                /* @__PURE__ */ w.jsxs(MR, { children: [
                  /* @__PURE__ */ w.jsx(mc, { children: C.description || "Inspect the weapon before adding it to your loadout." }),
                  /* @__PURE__ */ w.jsx("div", { className: "armory-mobile-stats", children: /* @__PURE__ */ w.jsx(uy, { entry: C }) })
                ] })
              ] }) }, C.id)
            ] }),
            /* @__PURE__ */ w.jsx(A0, { children: /* @__PURE__ */ w.jsx("span", { children: i === "gun" ? "Damage shown at close range. Range and aim affect each hit." : "Stats describe the primary strike." }) })
          ] }) : /* @__PURE__ */ w.jsx(ty, { children: /* @__PURE__ */ w.jsxs(ny, { children: [
            /* @__PURE__ */ w.jsx(ly, { children: "Choose a weapon" }),
            /* @__PURE__ */ w.jsx(ay, { children: "Select a card to inspect its model and stats." })
          ] }) }) })
        ] })
      ] }),
      /* @__PURE__ */ w.jsxs(X4, { className: "armory-dialog-footer", children: [
        /* @__PURE__ */ w.jsxs("div", { className: "armory-equipped-note", children: [
          /* @__PURE__ */ w.jsx("span", { children: "Current loadout" }),
          /* @__PURE__ */ w.jsx("strong", { children: I?.name || "No weapon selected" })
        ] }),
        /* @__PURE__ */ w.jsxs("div", { className: "armory-footer-actions", children: [
          /* @__PURE__ */ w.jsx(za, { variant: "outline", "data-armory-action": "cancel", onClick: () => _(!1), children: "Cancel" }),
          /* @__PURE__ */ w.jsxs(za, { variant: "equip", size: "lg", "data-armory-action": "equip", disabled: !C || C.disabled || l.disabled, onClick: () => {
            C && c(C.id) && _(!1);
          }, children: [
            "Equip ",
            C?.name || "weapon",
            /* @__PURE__ */ w.jsx(rC, { "data-icon": "inline-end" })
          ] })
        ] })
      ] })
    ] })
  ] });
}
const Bm = /* @__PURE__ */ new WeakMap();
function S3({ select: l, title: i, kind: r = "gun", portalContainer: s }) {
  if (!l || l.tagName !== "SELECT") throw new TypeError("mountWeaponArmory requires a native select");
  const c = Bm.get(l);
  if (c)
    return c.sync(), c;
  const f = l.ownerDocument.createElement("div");
  f.className = "voxel-armory-root", f.dataset.voxelArmory = "", f.dataset.selectId = l.id;
  const m = { hidden: l.hidden, tabIndex: l.getAttribute("tabindex"), ariaHidden: l.getAttribute("aria-hidden") };
  l.insertAdjacentElement("afterend", f);
  const v = SE.createRoot(f), y = sy.createRef();
  let h = !1, p, g, x = !0;
  const T = (M) => {
    const R = Array.from(l.options).find((I) => I.value === M);
    return h || l.disabled || !R || R.disabled || R.parentElement?.tagName === "OPTGROUP" && R.parentElement.disabled ? !1 : (l.value !== M && (l.value = M, l.dispatchEvent(new Event("change", { bubbles: !0 }))), E.sync(), !0);
  }, A = () => {
    if (h || !x && p === l.value && g === l.disabled) return;
    p = l.value, g = l.disabled, x = !1, f.dataset.selectedWeapon = l.value, f.dataset.disabled = String(l.disabled);
    const M = { value: l.value, disabled: l.disabled, entries: f3(l, r) };
    v.render(/* @__PURE__ */ w.jsx(b3, { snapshot: M, kind: r, portalContainer: s, title: i || (r === "melee" ? "Choose your melee weapon" : "Choose your weapon"), onCommit: T, commandRef: y }));
  }, N = new MutationObserver((M) => {
    M.some((R) => R.target !== l || R.type !== "attributes") && (x = !0), A();
  }), E = {
    sync: A,
    close: () => y.current?.close(),
    isOpen: () => y.current?.isOpen() || !1,
    focus: () => y.current?.focus(),
    destroy: () => {
      h || (h = !0, N.disconnect(), l.removeEventListener("change", A), v.unmount(), f.remove(), Bm.delete(l), l.hidden = m.hidden, m.tabIndex === null ? l.removeAttribute("tabindex") : l.setAttribute("tabindex", m.tabIndex), m.ariaHidden === null ? l.removeAttribute("aria-hidden") : l.setAttribute("aria-hidden", m.ariaHidden));
    }
  };
  try {
    zo.flushSync(A), l.hidden = !0, l.tabIndex = -1, l.setAttribute("aria-hidden", "true"), l.addEventListener("change", A), N.observe(l, { childList: !0, subtree: !0, attributes: !0, attributeFilter: ["disabled", "selected", "value", "label"], characterData: !0 }), Bm.set(l, E);
  } catch (M) {
    throw E.destroy(), M;
  }
  return E;
}
export {
  S3 as mountWeaponArmory
};
