import { weaponStats as m1, weaponDamage as h1, WEAPONS as p1 } from "./voxel-weapons.js";
import { meleeComboLength as y1, meleeProfile as b1, MELEE_WEAPONS as S1, MELEE_COMBO_WINDOW_TICKS as E1 } from "./voxel-melee.js";
function T1(a, r) {
  for (var o = 0; o < r.length; o++) {
    const c = r[o];
    if (typeof c != "string" && !Array.isArray(c)) {
      for (const f in c)
        if (f !== "default" && !(f in a)) {
          const d = Object.getOwnPropertyDescriptor(c, f);
          d && Object.defineProperty(a, f, d.get ? d : {
            enumerable: !0,
            get: () => c[f]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(a, Symbol.toStringTag, { value: "Module" }));
}
function x1(a) {
  return a && a.__esModule && Object.prototype.hasOwnProperty.call(a, "default") ? a.default : a;
}
var td = { exports: {} }, br = {};
var rh;
function C1() {
  if (rh) return br;
  rh = 1;
  var a = /* @__PURE__ */ Symbol.for("react.transitional.element"), r = /* @__PURE__ */ Symbol.for("react.fragment");
  function o(c, f, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), f.key !== void 0 && (m = "" + f.key), "key" in f) {
      d = {};
      for (var p in f)
        p !== "key" && (d[p] = f[p]);
    } else d = f;
    return f = d.ref, {
      $$typeof: a,
      type: c,
      key: m,
      ref: f !== void 0 ? f : null,
      props: d
    };
  }
  return br.Fragment = r, br.jsx = o, br.jsxs = o, br;
}
var oh;
function R1() {
  return oh || (oh = 1, td.exports = C1()), td.exports;
}
var O = R1(), nd = { exports: {} }, He = {};
var ch;
function A1() {
  if (ch) return He;
  ch = 1;
  var a = /* @__PURE__ */ Symbol.for("react.transitional.element"), r = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), c = /* @__PURE__ */ Symbol.for("react.strict_mode"), f = /* @__PURE__ */ Symbol.for("react.profiler"), d = /* @__PURE__ */ Symbol.for("react.consumer"), m = /* @__PURE__ */ Symbol.for("react.context"), p = /* @__PURE__ */ Symbol.for("react.forward_ref"), h = /* @__PURE__ */ Symbol.for("react.suspense"), y = /* @__PURE__ */ Symbol.for("react.memo"), b = /* @__PURE__ */ Symbol.for("react.lazy"), g = /* @__PURE__ */ Symbol.for("react.activity"), x = /* @__PURE__ */ Symbol.for("react.view_transition"), q = Symbol.iterator;
  function j(E) {
    return E === null || typeof E != "object" ? null : (E = q && E[q] || E["@@iterator"], typeof E == "function" ? E : null);
  }
  var Y = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, _ = Object.assign, R = {};
  function M(E, U, le) {
    this.props = E, this.context = U, this.refs = R, this.updater = le || Y;
  }
  M.prototype.isReactComponent = {}, M.prototype.setState = function(E, U) {
    if (typeof E != "object" && typeof E != "function" && E != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, E, U, "setState");
  }, M.prototype.forceUpdate = function(E) {
    this.updater.enqueueForceUpdate(this, E, "forceUpdate");
  };
  function F() {
  }
  F.prototype = M.prototype;
  function A(E, U, le) {
    this.props = E, this.context = U, this.refs = R, this.updater = le || Y;
  }
  var N = A.prototype = new F();
  N.constructor = A, _(N, M.prototype), N.isPureReactComponent = !0;
  var Q = Array.isArray;
  function L() {
  }
  var V = { H: null, A: null, T: null, S: null }, P = Object.prototype.hasOwnProperty;
  function Z(E, U, le) {
    var re = le.ref;
    return {
      $$typeof: a,
      type: E,
      key: U,
      ref: re !== void 0 ? re : null,
      props: le
    };
  }
  function K(E, U) {
    return Z(E.type, U, E.props);
  }
  function te(E) {
    return typeof E == "object" && E !== null && E.$$typeof === a;
  }
  function fe(E) {
    var U = { "=": "=0", ":": "=2" };
    return "$" + E.replace(/[=:]/g, function(le) {
      return U[le];
    });
  }
  var ae = /\/+/g;
  function oe(E, U) {
    return typeof E == "object" && E !== null && E.key != null ? fe("" + E.key) : U.toString(36);
  }
  function I(E) {
    switch (E.status) {
      case "fulfilled":
        return E.value;
      case "rejected":
        throw E.reason;
      default:
        switch (typeof E.status == "string" ? E.then(L, L) : (E.status = "pending", E.then(
          function(U) {
            E.status === "pending" && (E.status = "fulfilled", E.value = U);
          },
          function(U) {
            E.status === "pending" && (E.status = "rejected", E.reason = U);
          }
        )), E.status) {
          case "fulfilled":
            return E.value;
          case "rejected":
            throw E.reason;
        }
    }
    throw E;
  }
  function ce(E, U, le, re, me) {
    var ue = typeof E;
    (ue === "undefined" || ue === "boolean") && (E = null);
    var ye = !1;
    if (E === null) ye = !0;
    else
      switch (ue) {
        case "bigint":
        case "string":
        case "number":
          ye = !0;
          break;
        case "object":
          switch (E.$$typeof) {
            case a:
            case r:
              ye = !0;
              break;
            case b:
              return ye = E._init, ce(
                ye(E._payload),
                U,
                le,
                re,
                me
              );
          }
      }
    if (ye)
      return me = me(E), ye = re === "" ? "." + oe(E, 0) : re, Q(me) ? (le = "", ye != null && (le = ye.replace(ae, "$&/") + "/"), ce(me, U, le, "", function(tt) {
        return tt;
      })) : me != null && (te(me) && (me = K(
        me,
        le + (me.key == null || E && E.key === me.key ? "" : ("" + me.key).replace(
          ae,
          "$&/"
        ) + "/") + ye
      )), U.push(me)), 1;
    ye = 0;
    var se = re === "" ? "." : re + ":";
    if (Q(E))
      for (var ve = 0; ve < E.length; ve++)
        re = E[ve], ue = se + oe(re, ve), ye += ce(
          re,
          U,
          le,
          ue,
          me
        );
    else if (ve = j(E), typeof ve == "function")
      for (E = ve.call(E), ve = 0; !(re = E.next()).done; )
        re = re.value, ue = se + oe(re, ve++), ye += ce(
          re,
          U,
          le,
          ue,
          me
        );
    else if (ue === "object") {
      if (typeof E.then == "function")
        return ce(
          I(E),
          U,
          le,
          re,
          me
        );
      throw U = String(E), Error(
        "Objects are not valid as a React child (found: " + (U === "[object Object]" ? "object with keys {" + Object.keys(E).join(", ") + "}" : U) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return ye;
  }
  function ne(E, U, le) {
    if (E == null) return E;
    var re = [], me = 0;
    return ce(E, re, "", "", function(ue) {
      return U.call(le, ue, me++);
    }), re;
  }
  function ie(E) {
    if (E._status === -1) {
      var U = E._result, le = U();
      le.then(
        function(re) {
          (E._status === 0 || E._status === -1) && (E._status = 1, E._result = re, le.status === void 0 && (le.status = "fulfilled", le.value = re));
        },
        function(re) {
          (E._status === 0 || E._status === -1) && (E._status = 2, E._result = re, le.status === void 0 && (le.status = "rejected", le.reason = re));
        }
      ), E._status === -1 && (E._status = 0, E._result = le);
    }
    if (E._status === 1) return E._result.default;
    throw E._result;
  }
  var W = typeof reportError == "function" ? reportError : function(E) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var U = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof E == "object" && E !== null && typeof E.message == "string" ? String(E.message) : String(E),
        error: E
      });
      if (!window.dispatchEvent(U)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", E);
      return;
    }
    console.error(E);
  };
  function ze(E) {
    var U = V.T, le = {};
    le.types = U !== null ? U.types : null, V.T = le;
    try {
      var re = E(), me = V.S;
      me !== null && me(le, re), typeof re == "object" && re !== null && typeof re.then == "function" && re.then(L, W);
    } catch (ue) {
      W(ue);
    } finally {
      U !== null && le.types !== null && (U.types = le.types), V.T = U;
    }
  }
  function pe(E) {
    var U = V.T;
    if (U !== null) {
      var le = U.types;
      le === null ? U.types = [E] : le.indexOf(E) === -1 && le.push(E);
    } else ze(pe.bind(null, E));
  }
  var De = {
    map: ne,
    forEach: function(E, U, le) {
      ne(
        E,
        function() {
          U.apply(this, arguments);
        },
        le
      );
    },
    count: function(E) {
      var U = 0;
      return ne(E, function() {
        U++;
      }), U;
    },
    toArray: function(E) {
      return ne(E, function(U) {
        return U;
      }) || [];
    },
    only: function(E) {
      if (!te(E))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return E;
    }
  };
  return He.Activity = g, He.Children = De, He.Component = M, He.Fragment = o, He.Profiler = f, He.PureComponent = A, He.StrictMode = c, He.Suspense = h, He.ViewTransition = x, He.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = V, He.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(E) {
      return V.H.useMemoCache(E);
    }
  }, He.addTransitionType = pe, He.cache = function(E) {
    return function() {
      return E.apply(null, arguments);
    };
  }, He.cacheSignal = function() {
    return null;
  }, He.cloneElement = function(E, U, le) {
    if (E == null)
      throw Error(
        "The argument must be a React element, but you passed " + E + "."
      );
    var re = _({}, E.props), me = E.key;
    if (U != null)
      for (ue in U.key !== void 0 && (me = "" + U.key), U)
        !P.call(U, ue) || ue === "key" || ue === "__self" || ue === "__source" || ue === "ref" && U.ref === void 0 || (re[ue] = U[ue]);
    var ue = arguments.length - 2;
    if (ue === 1) re.children = le;
    else if (1 < ue) {
      for (var ye = Array(ue), se = 0; se < ue; se++)
        ye[se] = arguments[se + 2];
      re.children = ye;
    }
    return Z(E.type, me, re);
  }, He.createContext = function(E) {
    return E = {
      $$typeof: m,
      _currentValue: E,
      _currentValue2: E,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, E.Provider = E, E.Consumer = {
      $$typeof: d,
      _context: E
    }, E;
  }, He.createElement = function(E, U, le) {
    var re, me = {}, ue = null;
    if (U != null)
      for (re in U.key !== void 0 && (ue = "" + U.key), U)
        P.call(U, re) && re !== "key" && re !== "__self" && re !== "__source" && (me[re] = U[re]);
    var ye = arguments.length - 2;
    if (ye === 1) me.children = le;
    else if (1 < ye) {
      for (var se = Array(ye), ve = 0; ve < ye; ve++)
        se[ve] = arguments[ve + 2];
      me.children = se;
    }
    if (E && E.defaultProps)
      for (re in ye = E.defaultProps, ye)
        me[re] === void 0 && (me[re] = ye[re]);
    return Z(E, ue, me);
  }, He.createRef = function() {
    return { current: null };
  }, He.forwardRef = function(E) {
    return { $$typeof: p, render: E };
  }, He.isValidElement = te, He.lazy = function(E) {
    return {
      $$typeof: b,
      _payload: { _status: -1, _result: E },
      _init: ie
    };
  }, He.memo = function(E, U) {
    return {
      $$typeof: y,
      type: E,
      compare: U === void 0 ? null : U
    };
  }, He.startTransition = ze, He.unstable_useCacheRefresh = function() {
    return V.H.useCacheRefresh();
  }, He.use = function(E) {
    return V.H.use(E);
  }, He.useActionState = function(E, U, le) {
    return V.H.useActionState(E, U, le);
  }, He.useCallback = function(E, U) {
    return V.H.useCallback(E, U);
  }, He.useContext = function(E) {
    return V.H.useContext(E);
  }, He.useDebugValue = function() {
  }, He.useDeferredValue = function(E, U) {
    return V.H.useDeferredValue(E, U);
  }, He.useEffect = function(E, U) {
    return V.H.useEffect(E, U);
  }, He.useEffectEvent = function(E) {
    return V.H.useEffectEvent(E);
  }, He.useId = function() {
    return V.H.useId();
  }, He.useImperativeHandle = function(E, U, le) {
    return V.H.useImperativeHandle(E, U, le);
  }, He.useInsertionEffect = function(E, U) {
    return V.H.useInsertionEffect(E, U);
  }, He.useLayoutEffect = function(E, U) {
    return V.H.useLayoutEffect(E, U);
  }, He.useMemo = function(E, U) {
    return V.H.useMemo(E, U);
  }, He.useOptimistic = function(E, U) {
    return V.H.useOptimistic(E, U);
  }, He.useReducer = function(E, U, le) {
    return V.H.useReducer(E, U, le);
  }, He.useRef = function(E) {
    return V.H.useRef(E);
  }, He.useState = function(E) {
    return V.H.useState(E);
  }, He.useSyncExternalStore = function(E, U, le) {
    return V.H.useSyncExternalStore(
      E,
      U,
      le
    );
  }, He.useTransition = function() {
    return V.H.useTransition();
  }, He.version = "19.3.0", He;
}
var sh;
function Dr() {
  return sh || (sh = 1, nd.exports = A1()), nd.exports;
}
var S = Dr();
const s2 = /* @__PURE__ */ x1(S), O1 = /* @__PURE__ */ T1({
  __proto__: null,
  default: s2
}, [S]);
var ld = { exports: {} }, Sr = {}, ad = { exports: {} }, ud = {};
var fh;
function N1() {
  return fh || (fh = 1, (function(a) {
    function r(I, ce) {
      var ne = I.length;
      I.push(ce);
      e: for (; 0 < ne; ) {
        var ie = ne - 1 >>> 1, W = I[ie];
        if (0 < f(W, ce))
          I[ie] = ce, I[ne] = W, ne = ie;
        else break e;
      }
    }
    function o(I) {
      return I.length === 0 ? null : I[0];
    }
    function c(I) {
      if (I.length === 0) return null;
      var ce = I[0], ne = I.pop();
      if (ne !== ce) {
        I[0] = ne;
        e: for (var ie = 0, W = I.length, ze = W >>> 1; ie < ze; ) {
          var pe = 2 * (ie + 1) - 1, De = I[pe], E = pe + 1, U = I[E];
          if (0 > f(De, ne))
            E < W && 0 > f(U, De) ? (I[ie] = U, I[E] = ne, ie = E) : (I[ie] = De, I[pe] = ne, ie = pe);
          else if (E < W && 0 > f(U, ne))
            I[ie] = U, I[E] = ne, ie = E;
          else break e;
        }
      }
      return ce;
    }
    function f(I, ce) {
      var ne = I.sortIndex - ce.sortIndex;
      return ne !== 0 ? ne : I.id - ce.id;
    }
    if (a.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      a.unstable_now = function() {
        return d.now();
      };
    } else {
      var m = Date, p = m.now();
      a.unstable_now = function() {
        return m.now() - p;
      };
    }
    var h = [], y = [], b = 1, g = null, x = 3, q = !1, j = !1, Y = !1, _ = !1, R = typeof setTimeout == "function" ? setTimeout : null, M = typeof clearTimeout == "function" ? clearTimeout : null, F = typeof setImmediate < "u" ? setImmediate : null;
    function A(I) {
      for (var ce = o(y); ce !== null; ) {
        if (ce.callback === null) c(y);
        else if (ce.startTime <= I)
          c(y), ce.sortIndex = ce.expirationTime, r(h, ce);
        else break;
        ce = o(y);
      }
    }
    function N(I) {
      if (Y = !1, A(I), !j)
        if (o(h) !== null)
          j = !0, Q || (Q = !0, te());
        else {
          var ce = o(y);
          ce !== null && oe(N, ce.startTime - I);
        }
    }
    var Q = !1, L = -1, V = 5, P = -1;
    function Z() {
      return _ ? !0 : !(a.unstable_now() - P < V);
    }
    function K() {
      if (_ = !1, Q) {
        var I = a.unstable_now();
        P = I;
        var ce = !0;
        try {
          e: {
            j = !1, Y && (Y = !1, M(L), L = -1), q = !0;
            var ne = x;
            try {
              t: {
                for (A(I), g = o(h); g !== null && !(g.expirationTime > I && Z()); ) {
                  var ie = g.callback;
                  if (typeof ie == "function") {
                    g.callback = null, x = g.priorityLevel;
                    var W = ie(
                      g.expirationTime <= I
                    );
                    if (I = a.unstable_now(), typeof W == "function") {
                      g.callback = W, A(I), ce = !0;
                      break t;
                    }
                    g === o(h) && c(h), A(I);
                  } else c(h);
                  g = o(h);
                }
                if (g !== null) ce = !0;
                else {
                  var ze = o(y);
                  ze !== null && oe(
                    N,
                    ze.startTime - I
                  ), ce = !1;
                }
              }
              break e;
            } finally {
              g = null, x = ne, q = !1;
            }
            ce = void 0;
          }
        } finally {
          ce ? te() : Q = !1;
        }
      }
    }
    var te;
    if (typeof F == "function")
      te = function() {
        F(K);
      };
    else if (typeof MessageChannel < "u") {
      var fe = new MessageChannel(), ae = fe.port2;
      fe.port1.onmessage = K, te = function() {
        ae.postMessage(null);
      };
    } else
      te = function() {
        R(K, 0);
      };
    function oe(I, ce) {
      L = R(function() {
        I(a.unstable_now());
      }, ce);
    }
    a.unstable_IdlePriority = 5, a.unstable_ImmediatePriority = 1, a.unstable_LowPriority = 4, a.unstable_NormalPriority = 3, a.unstable_Profiling = null, a.unstable_UserBlockingPriority = 2, a.unstable_cancelCallback = function(I) {
      I.callback = null;
    }, a.unstable_forceFrameRate = function(I) {
      0 > I || 125 < I ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : V = 0 < I ? Math.floor(1e3 / I) : 5;
    }, a.unstable_getCurrentPriorityLevel = function() {
      return x;
    }, a.unstable_next = function(I) {
      switch (x) {
        case 1:
        case 2:
        case 3:
          var ce = 3;
          break;
        default:
          ce = x;
      }
      var ne = x;
      x = ce;
      try {
        return I();
      } finally {
        x = ne;
      }
    }, a.unstable_requestPaint = function() {
      _ = !0;
    }, a.unstable_runWithPriority = function(I, ce) {
      switch (I) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          I = 3;
      }
      var ne = x;
      x = I;
      try {
        return ce();
      } finally {
        x = ne;
      }
    }, a.unstable_scheduleCallback = function(I, ce, ne) {
      var ie = a.unstable_now();
      switch (typeof ne == "object" && ne !== null ? (ne = ne.delay, ne = typeof ne == "number" && 0 < ne ? ie + ne : ie) : ne = ie, I) {
        case 1:
          var W = -1;
          break;
        case 2:
          W = 250;
          break;
        case 5:
          W = 1073741823;
          break;
        case 4:
          W = 1e4;
          break;
        default:
          W = 5e3;
      }
      return W = ne + W, I = {
        id: b++,
        callback: ce,
        priorityLevel: I,
        startTime: ne,
        expirationTime: W,
        sortIndex: -1
      }, ne > ie ? (I.sortIndex = ne, r(y, I), o(h) === null && I === o(y) && (Y ? (M(L), L = -1) : Y = !0, oe(N, ne - ie))) : (I.sortIndex = W, r(h, I), j || q || (j = !0, Q || (Q = !0, te()))), I;
    }, a.unstable_shouldYield = Z, a.unstable_wrapCallback = function(I) {
      var ce = x;
      return function() {
        var ne = x;
        x = ce;
        try {
          return I.apply(this, arguments);
        } finally {
          x = ne;
        }
      };
    };
  })(ud)), ud;
}
var dh;
function z1() {
  return dh || (dh = 1, ad.exports = N1()), ad.exports;
}
var id = { exports: {} }, nn = {};
var vh;
function M1() {
  if (vh) return nn;
  vh = 1;
  var a = Dr();
  function r(b) {
    var g = "https://react.dev/errors/" + b;
    if (1 < arguments.length) {
      g += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var x = 2; x < arguments.length; x++)
        g += "&args[]=" + encodeURIComponent(arguments[x]);
    }
    return "Minified React error #" + b + "; visit " + g + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function o() {
  }
  var c = {
    d: {
      f: o,
      r: function() {
        throw Error(r(522));
      },
      D: o,
      C: o,
      L: o,
      m: o,
      X: o,
      S: o,
      M: o
    },
    p: 0,
    findDOMNode: null
  }, f = /* @__PURE__ */ Symbol.for("react.portal"), d = /* @__PURE__ */ Symbol.for("react.recoverable"), m = /* @__PURE__ */ Symbol.for("react.optimistic_key");
  function p(b, g, x) {
    var q = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: f,
      key: q == null ? null : q === m ? m : "" + q,
      children: b,
      containerInfo: g,
      implementation: x
    };
  }
  var h = a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function y(b, g) {
    if (b === "font") return "";
    if (typeof g == "string")
      return g === "use-credentials" ? g : "";
  }
  return nn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = c, nn.browser = function(b) {
    return { $$typeof: d, _reason: b };
  }, nn.createPortal = function(b, g) {
    var x = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!g || g.nodeType !== 1 && g.nodeType !== 9 && g.nodeType !== 11)
      throw Error(r(299));
    return p(b, g, null, x);
  }, nn.flushSync = function(b) {
    var g = h.T, x = c.p;
    try {
      if (h.T = null, c.p = 2, b) return b();
    } finally {
      h.T = g, c.p = x, c.d.f();
    }
  }, nn.preconnect = function(b, g) {
    typeof b == "string" && (g ? (g = g.crossOrigin, g = typeof g == "string" ? g === "use-credentials" ? g : "" : void 0) : g = null, c.d.C(b, g));
  }, nn.prefetchDNS = function(b) {
    typeof b == "string" && c.d.D(b);
  }, nn.preinit = function(b, g) {
    if (typeof b == "string" && g && typeof g.as == "string") {
      var x = g.as, q = y(x, g.crossOrigin), j = typeof g.integrity == "string" ? g.integrity : void 0, Y = typeof g.fetchPriority == "string" ? g.fetchPriority : void 0;
      x === "style" ? c.d.S(
        b,
        typeof g.precedence == "string" ? g.precedence : void 0,
        {
          crossOrigin: q,
          integrity: j,
          fetchPriority: Y
        }
      ) : x === "script" && c.d.X(b, {
        crossOrigin: q,
        integrity: j,
        fetchPriority: Y,
        nonce: typeof g.nonce == "string" ? g.nonce : void 0
      });
    }
  }, nn.preinitModule = function(b, g) {
    if (typeof b == "string")
      if (typeof g == "object" && g !== null) {
        if (g.as == null || g.as === "script") {
          var x = y(
            g.as,
            g.crossOrigin
          );
          c.d.M(b, {
            crossOrigin: x,
            integrity: typeof g.integrity == "string" ? g.integrity : void 0,
            nonce: typeof g.nonce == "string" ? g.nonce : void 0,
            fetchPriority: typeof g.fetchPriority == "string" ? g.fetchPriority : void 0
          });
        }
      } else g == null && c.d.M(b);
  }, nn.preload = function(b, g) {
    if (typeof b == "string" && typeof g == "object" && g !== null && typeof g.as == "string") {
      var x = g.as, q = y(x, g.crossOrigin);
      c.d.L(b, x, {
        crossOrigin: q,
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
  }, nn.preloadModule = function(b, g) {
    if (typeof b == "string")
      if (g) {
        var x = y(g.as, g.crossOrigin);
        c.d.m(b, {
          as: typeof g.as == "string" && g.as !== "script" ? g.as : void 0,
          crossOrigin: x,
          integrity: typeof g.integrity == "string" ? g.integrity : void 0,
          nonce: typeof g.nonce == "string" ? g.nonce : void 0,
          fetchPriority: typeof g.fetchPriority == "string" ? g.fetchPriority : void 0
        });
      } else c.d.m(b);
  }, nn.requestFormReset = function(b) {
    c.d.r(b);
  }, nn.unstable_batchedUpdates = function(b, g) {
    return b(g);
  }, nn.useFormState = function(b, g, x) {
    return h.H.useFormState(b, g, x);
  }, nn.useFormStatus = function() {
    return h.H.useHostTransitionStatus();
  }, nn.version = "19.3.0", nn;
}
var gh;
function f2() {
  if (gh) return id.exports;
  gh = 1;
  function a() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(a);
      } catch (r) {
        console.error(r);
      }
  }
  return a(), id.exports = M1(), id.exports;
}
var mh;
function D1() {
  if (mh) return Sr;
  mh = 1;
  var a = z1(), r = Dr(), o = f2();
  function c(e) {
    var t = "https://react.dev/errors/" + e;
    if (1 < arguments.length) {
      t += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var n = 2; n < arguments.length; n++)
        t += "&args[]=" + encodeURIComponent(arguments[n]);
    }
    return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function f(e) {
    return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
  }
  function d(e) {
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
  function p(e) {
    if (e.tag === 31) {
      var t = e.memoizedState;
      if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
    }
    return null;
  }
  function h(e) {
    if (d(e) !== e)
      throw Error(c(188));
  }
  function y(e) {
    var t = e.alternate;
    if (!t) {
      if (t = d(e), t === null) throw Error(c(188));
      return t !== e ? null : e;
    }
    for (var n = e, l = t; ; ) {
      var u = n.return;
      if (u === null) break;
      var i = u.alternate;
      if (i === null) {
        if (l = u.return, l !== null) {
          n = l;
          continue;
        }
        break;
      }
      if (u.child === i.child) {
        for (i = u.child; i; ) {
          if (i === n) return h(u), e;
          if (i === l) return h(u), t;
          i = i.sibling;
        }
        throw Error(c(188));
      }
      if (n.return !== l.return) n = u, l = i;
      else {
        for (var s = !1, v = u.child; v; ) {
          if (v === n) {
            s = !0, n = u, l = i;
            break;
          }
          if (v === l) {
            s = !0, l = u, n = i;
            break;
          }
          v = v.sibling;
        }
        if (!s) {
          for (v = i.child; v; ) {
            if (v === n) {
              s = !0, n = i, l = u;
              break;
            }
            if (v === l) {
              s = !0, l = i, n = u;
              break;
            }
            v = v.sibling;
          }
          if (!s) throw Error(c(189));
        }
      }
      if (n.alternate !== l) throw Error(c(190));
    }
    if (n.tag !== 3) throw Error(c(188));
    return n.stateNode.current === n ? e : t;
  }
  function b(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e;
    for (e = e.child; e !== null; ) {
      if (t = b(e), t !== null) return t;
      e = e.sibling;
    }
    return null;
  }
  function g(e, t, n, l, u, i) {
    for (; e !== null; ) {
      if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, l, u, i) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && g(
        e.child,
        t,
        n,
        l,
        u,
        i
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
  function q(e) {
    var t = !1;
    for (e = e.return; e !== null && (e.tag === 4 && (t = !0), !(e.tag === 3 || e.tag === 5 || e.tag === 27)); )
      e = e.return;
    return t;
  }
  function j(e) {
    var t = [null, null], n = x(e);
    return n === null || Y(
      t,
      e,
      n.child,
      { foundSelf: !1 }
    ), t;
  }
  function Y(e, t, n, l) {
    for (; n !== null; ) {
      if (n === t) l.foundSelf = !0;
      else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
        if (l.foundSelf) return e[1] = n, !0;
        e[0] = n;
      } else if ((n.tag !== 22 || n.memoizedState === null) && Y(
        e,
        t,
        n.child,
        l
      ))
        return !0;
      n = n.sibling;
    }
    return !1;
  }
  function _(e) {
    switch (e.tag) {
      case 5:
      case 27:
      case 6:
        return e.stateNode;
      case 3:
        return e.stateNode.containerInfo;
      default:
        throw Error(c(559));
    }
  }
  var R = null, M = null;
  function F(e, t, n) {
    return e === n ? !0 : e === t ? (R = e, !0) : !1;
  }
  function A(e, t, n) {
    return e === n ? (M = e, !1) : e === t ? (M !== null && (R = e), !0) : !1;
  }
  function N(e) {
    if (e === null) return null;
    do
      e = e === null ? null : e.return;
    while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
    return e || null;
  }
  function Q(e, t, n) {
    for (var l = 0, u = e; u; u = n(u)) l++;
    u = 0;
    for (var i = t; i; i = n(i)) u++;
    for (; 0 < l - u; ) e = n(e), l--;
    for (; 0 < u - l; ) t = n(t), u--;
    for (; l--; ) {
      if (e === t || t !== null && e === t.alternate)
        return e;
      e = n(e), t = n(t);
    }
    return null;
  }
  var L = Object.assign, V = /* @__PURE__ */ Symbol.for("react.element"), P = /* @__PURE__ */ Symbol.for("react.transitional.element"), Z = /* @__PURE__ */ Symbol.for("react.portal"), K = /* @__PURE__ */ Symbol.for("react.fragment"), te = /* @__PURE__ */ Symbol.for("react.strict_mode"), fe = /* @__PURE__ */ Symbol.for("react.profiler"), ae = /* @__PURE__ */ Symbol.for("react.consumer"), oe = /* @__PURE__ */ Symbol.for("react.context"), I = /* @__PURE__ */ Symbol.for("react.forward_ref"), ce = /* @__PURE__ */ Symbol.for("react.suspense"), ne = /* @__PURE__ */ Symbol.for("react.suspense_list"), ie = /* @__PURE__ */ Symbol.for("react.memo"), W = /* @__PURE__ */ Symbol.for("react.lazy"), ze = /* @__PURE__ */ Symbol.for("react.activity"), pe = /* @__PURE__ */ Symbol.for("react.legacy_hidden"), De = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), E = /* @__PURE__ */ Symbol.for("react.view_transition"), U = /* @__PURE__ */ Symbol.for("react.recoverable"), le = Symbol.iterator;
  function re(e) {
    return e === null || typeof e != "object" ? null : (e = le && e[le] || e["@@iterator"], typeof e == "function" ? e : null);
  }
  var me = /* @__PURE__ */ Symbol.for("react.client.reference");
  function ue(e) {
    if (e == null) return null;
    if (typeof e == "function")
      return e.$$typeof === me ? null : e.displayName || e.name || null;
    if (typeof e == "string") return e;
    switch (e) {
      case K:
        return "Fragment";
      case fe:
        return "Profiler";
      case te:
        return "StrictMode";
      case ce:
        return "Suspense";
      case ne:
        return "SuspenseList";
      case ze:
        return "Activity";
      case E:
        return "ViewTransition";
    }
    if (typeof e == "object")
      switch (e.$$typeof) {
        case Z:
          return "Portal";
        case oe:
          return e.displayName || "Context";
        case ae:
          return (e._context.displayName || "Context") + ".Consumer";
        case I:
          var t = e.render;
          return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
        case ie:
          return t = e.displayName || null, t !== null ? t : ue(e.type) || "Memo";
        case W:
          t = e._payload, e = e._init;
          try {
            return ue(e(t));
          } catch {
          }
      }
    return null;
  }
  var ye = Array.isArray, se = r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ve = o.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, tt = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, je = [], Xe = -1;
  function be(e) {
    return { current: e };
  }
  function _e(e) {
    0 > Xe || (e.current = je[Xe], je[Xe] = null, Xe--);
  }
  function Be(e, t) {
    Xe++, je[Xe] = e.current, e.current = t;
  }
  var Te = be(null), Ie = be(null), Re = be(null), at = be(null);
  function qe(e, t) {
    switch (Be(Re, t), Be(Ie, e), Be(Te, null), t.nodeType) {
      case 9:
      case 11:
        e = (e = t.documentElement) && (e = e.namespaceURI) ? hm(e) : 0;
        break;
      default:
        if (e = t.tagName, t = t.namespaceURI)
          t = hm(t), e = pm(t, e);
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
    _e(Te), Be(Te, e);
  }
  function ft() {
    _e(Te), _e(Ie), _e(Re);
  }
  function ge(e) {
    var t = e.memoizedState;
    t !== null && (di._currentValue = t.memoizedState, Be(at, e)), t = Te.current;
    var n = pm(t, e.type);
    t !== n && (Be(Ie, e), Be(Te, n));
  }
  function Se(e) {
    Ie.current === e && (_e(Te), _e(Ie)), at.current === e && (_e(at), di._currentValue = tt);
  }
  var St, Et;
  function nt(e) {
    if (St === void 0)
      try {
        throw Error();
      } catch (n) {
        var t = n.stack.trim().match(/\n( *(at )?)/);
        St = t && t[1] || "", Et = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + St + e + Et;
  }
  var Rn = !1;
  function ln(e, t) {
    if (!e || Rn) return "";
    Rn = !0;
    var n = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var l = {
        DetermineComponentFrameRoot: function() {
          try {
            if (t) {
              var J = function() {
                throw Error();
              };
              if (Object.defineProperty(J.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(J, []);
                } catch (de) {
                  var z = de;
                }
                Reflect.construct(e, [], J);
              } else {
                try {
                  J.call();
                } catch (de) {
                  z = de;
                }
                J = !1;
                try {
                  var B = Object.getOwnPropertyDescriptor(
                    e.prototype,
                    "props"
                  );
                  Object.defineProperty(e.prototype, "props", {
                    configurable: !0,
                    set: function() {
                      throw Error();
                    }
                  }), J = !0, new e();
                } finally {
                  J && (B !== void 0 ? Object.defineProperty(e.prototype, "props", B) : delete e.prototype.props);
                }
              }
            } else {
              try {
                throw Error();
              } catch (de) {
                z = de;
              }
              (J = e()) && typeof J.catch == "function" && J.catch(function() {
              });
            }
          } catch (de) {
            if (de && z && typeof de.stack == "string")
              return [de.stack, z.stack];
          }
          return [null, null];
        }
      };
      l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var u = Object.getOwnPropertyDescriptor(
        l.DetermineComponentFrameRoot,
        "name"
      );
      u && u.configurable && Object.defineProperty(
        l.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var i = l.DetermineComponentFrameRoot(), s = i[0], v = i[1];
      if (s && v) {
        var T = s.split(`
`), w = v.split(`
`);
        for (u = l = 0; l < T.length && !T[l].includes("DetermineComponentFrameRoot"); )
          l++;
        for (; u < w.length && !w[u].includes(
          "DetermineComponentFrameRoot"
        ); )
          u++;
        if (l === T.length || u === w.length)
          for (l = T.length - 1, u = w.length - 1; 1 <= l && 0 <= u && T[l] !== w[u]; )
            u--;
        for (; 1 <= l && 0 <= u; l--, u--)
          if (T[l] !== w[u]) {
            if (l !== 1 || u !== 1)
              do
                if (l--, u--, 0 > u || T[l] !== w[u]) {
                  var X = `
` + T[l].replace(" at new ", " at ");
                  return e.displayName && X.includes("<anonymous>") && (X = X.replace("<anonymous>", e.displayName)), X;
                }
              while (1 <= l && 0 <= u);
            break;
          }
      }
    } finally {
      Rn = !1, Error.prepareStackTrace = n;
    }
    return (n = e ? e.displayName || e.name : "") ? nt(n) : "";
  }
  function an(e, t) {
    switch (e.tag) {
      case 26:
      case 27:
      case 5:
        return nt(e.type);
      case 16:
        return nt("Lazy");
      case 13:
        return e.child !== t && t !== null ? nt("Suspense Fallback") : nt("Suspense");
      case 19:
        return nt("SuspenseList");
      case 0:
      case 15:
        return ln(e.type, !1);
      case 11:
        return ln(e.type.render, !1);
      case 1:
        return ln(e.type, !0);
      case 31:
        return nt("Activity");
      case 30:
        return nt("ViewTransition");
      default:
        return "";
    }
  }
  function $n(e) {
    try {
      var t = "", n = null;
      do
        t += an(e, n), n = e, e = e.return;
      while (e);
      return t;
    } catch (l) {
      return `
Error generating stack: ` + l.message + `
` + l.stack;
    }
  }
  var Ml = Object.prototype.hasOwnProperty, Va = a.unstable_scheduleCallback, Pl = a.unstable_cancelCallback, Wl = a.unstable_shouldYield, Ci = a.unstable_requestPaint, Zt = a.unstable_now, Eu = a.unstable_getCurrentPriorityLevel, gl = a.unstable_ImmediatePriority, Tu = a.unstable_UserBlockingPriority, yn = a.unstable_NormalPriority, Br = a.unstable_LowPriority, Ri = a.unstable_IdlePriority, Lr = a.log, Vr = a.unstable_setDisableYieldValue, $l = null, un = null;
  function _t(e) {
    if (typeof Lr == "function" && Vr(e), un && typeof un.setStrictMode == "function")
      try {
        un.setStrictMode($l, e);
      } catch {
      }
  }
  var Gt = Math.clz32 ? Math.clz32 : na, ea = Math.log, ta = Math.LN2;
  function na(e) {
    return e >>>= 0, e === 0 ? 32 : 31 - (ea(e) / ta | 0) | 0;
  }
  var Dl = 256, ml = 262144, el = 4194304;
  function _l(e) {
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
  function tl(e, t, n) {
    var l = e.pendingLanes;
    if (l === 0) return 0;
    var u = 0, i = e.suspendedLanes, s = e.pingedLanes;
    e = e.warmLanes;
    var v = l & 134217727;
    return v !== 0 ? (l = v & ~i, l !== 0 ? u = _l(l) : (s &= v, s !== 0 ? u = _l(s) : n || (n = v & ~e, n !== 0 && (u = _l(n))))) : (v = l & ~i, v !== 0 ? u = _l(v) : s !== 0 ? u = _l(s) : n || (n = l & ~e, n !== 0 && (u = _l(n)))), u === 0 ? 0 : t !== 0 && t !== u && (t & i) === 0 && (i = u & -u, n = t & -t, i >= n || i === 32 && (n & 4194048) !== 0) ? t : u;
  }
  function nl(e, t) {
    return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
  }
  function la(e, t) {
    (t & 8) !== 0 && (t |= t & 32);
    var n = e.entangledLanes;
    if (n !== 0)
      for (e = e.entanglements, n &= t; 0 < n; ) {
        var l = 31 - Gt(n), u = 1 << l;
        t |= e[l], n &= ~u;
      }
    return t;
  }
  function Ai(e, t) {
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
  function ll() {
    var e = el;
    return el <<= 1, (el & 62914560) === 0 && (el = 4194304), e;
  }
  function xu(e) {
    for (var t = [], n = 0; 31 > n; n++) t.push(e);
    return t;
  }
  function wl(e, t) {
    e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
  }
  function Cu(e, t, n, l, u, i) {
    var s = e.pendingLanes;
    e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
    var v = e.entanglements, T = e.expirationTimes, w = e.hiddenUpdates;
    for (n = s & ~n; 0 < n; ) {
      var X = 31 - Gt(n), J = 1 << X;
      v[X] = 0, T[X] = -1;
      var z = w[X];
      if (z !== null)
        for (w[X] = null, X = 0; X < z.length; X++) {
          var B = z[X];
          B !== null && (B.lane &= -536870913);
        }
      n &= ~J;
    }
    l !== 0 && al(e, l, 0), i !== 0 && u === 0 && e.tag !== 0 && (e.suspendedLanes |= i & ~(s & ~t));
  }
  function al(e, t, n) {
    e.pendingLanes |= t, e.suspendedLanes &= ~t;
    var l = 31 - Gt(t);
    e.entangledLanes |= t, e.entanglements[l] = e.entanglements[l] | 1073741824 | n & 261930;
  }
  function Ru(e, t) {
    var n = e.entangledLanes |= t;
    for (e = e.entanglements; n; ) {
      var l = 31 - Gt(n), u = 1 << l;
      u & t | e[l] & t && (e[l] |= t), n &= ~u;
    }
  }
  function qa(e, t) {
    var n = t & -t;
    return n = (n & 42) !== 0 ? 1 : aa(n), (n & (e.suspendedLanes | t)) !== 0 ? 0 : n;
  }
  function aa(e) {
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
  function qn(e) {
    return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function Yn() {
    var e = ve.p;
    return e !== 0 ? e : (e = window.event, e === void 0 ? 32 : eh(e.type));
  }
  function Ya(e, t) {
    var n = ve.p;
    try {
      return ve.p = e, t();
    } finally {
      ve.p = n;
    }
  }
  var zt = Math.random().toString(36).slice(2), Tt = "__reactFiber$" + zt, kt = "__reactProps$" + zt, An = "__reactContainer$" + zt, Oi = "__reactEvents$" + zt, Au = "__reactListeners$" + zt, Ou = "__reactHandles$" + zt, ua = "__reactResources$" + zt, Ga = "__reactMarker$" + zt, Nu = "__reactLoad$" + zt;
  function zu(e) {
    delete e[Tt], delete e[kt], delete e[Au], delete e[Ou];
  }
  function ul(e) {
    var t;
    if (t = e[Tt]) return t;
    for (var n = e.parentNode; n; ) {
      if (t = n[An] || n[Tt]) {
        if (n = t.alternate, t.child !== null || n !== null && n.child !== null)
          for (e = jm(e); e !== null; ) {
            if (n = e[Tt]) return n;
            e = jm(e);
          }
        return t;
      }
      e = n, n = e.parentNode;
    }
    return null;
  }
  function Xa(e) {
    if (e = e[Tt] || e[An]) {
      var t = e.tag;
      if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3)
        return e;
    }
    return null;
  }
  function G(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
    throw Error(c(33));
  }
  function $(e) {
    var t = e[ua];
    return t || (t = e[ua] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), t;
  }
  function ee(e) {
    e[Ga] = !0;
  }
  function xe(e) {
    e[Nu] = void 0;
  }
  var Le = /* @__PURE__ */ new Set(), Ue = {};
  function Qe(e, t) {
    dt(e, t), dt(e + "Capture", t);
  }
  function dt(e, t) {
    for (Ue[e] = t, e = 0; e < t.length; e++)
      Le.add(t[e]);
  }
  var ut = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), Me = {}, Ve = {};
  function et(e) {
    return Ml.call(Ve, e) ? !0 : Ml.call(Me, e) ? !1 : ut.test(e) ? Ve[e] = !0 : (Me[e] = !0, !1);
  }
  var Ne = !1;
  function Vt() {
    var e = Ne;
    return Ne = !1, e;
  }
  function xt(e, t, n) {
    if (et(t))
      if (n === null) e.removeAttribute(t);
      else {
        switch (typeof n) {
          case "undefined":
          case "function":
          case "symbol":
            e.removeAttribute(t);
            return;
          case "boolean":
            var l = t.toLowerCase().slice(0, 5);
            if (l !== "data-" && l !== "aria-") {
              e.removeAttribute(t);
              return;
            }
        }
        e.setAttribute(t, n);
      }
  }
  function On(e, t, n) {
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
  function wt(e, t, n, l) {
    if (l === null) e.removeAttribute(n);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(n);
          return;
      }
      e.setAttributeNS(t, n, l);
    }
  }
  function jt(e) {
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
  function Mu(e) {
    var t = e.type;
    return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
  }
  function Ni(e, t, n) {
    var l = Object.getOwnPropertyDescriptor(
      e.constructor.prototype,
      t
    );
    if (!e.hasOwnProperty(t) && typeof l < "u" && typeof l.get == "function" && typeof l.set == "function") {
      var u = l.get, i = l.set;
      return Object.defineProperty(e, t, {
        configurable: !0,
        get: function() {
          return u.call(this);
        },
        set: function(s) {
          n = "" + s, i.call(this, s);
        }
      }), Object.defineProperty(e, t, {
        enumerable: l.enumerable
      }), {
        getValue: function() {
          return n;
        },
        setValue: function(s) {
          n = "" + s;
        },
        stopTracking: function() {
          e._valueTracker = null, delete e[t];
        }
      };
    }
  }
  function jl(e) {
    if (!e._valueTracker) {
      var t = Mu(e) ? "checked" : "value";
      e._valueTracker = Ni(
        e,
        t,
        "" + e[t]
      );
    }
  }
  function Du(e) {
    if (!e) return !1;
    var t = e._valueTracker;
    if (!t) return !0;
    var n = t.getValue(), l = "";
    return e && (l = Mu(e) ? e.checked ? "true" : "false" : e.value), e = l, e !== n ? (t.setValue(e), !0) : !1;
  }
  var qr = /[\n"\\]/g;
  function yt(e) {
    return e.replace(
      qr,
      function(t) {
        return "\\" + t.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function rn(e, t, n, l, u, i, s, v) {
    e.name = "", s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.type = s : e.removeAttribute("type"), t != null ? s === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + jt(t)) : e.value !== "" + jt(t) && (e.value = "" + jt(t)) : s !== "submit" && s !== "reset" || e.removeAttribute("value"), t != null ? s === "number" && e.value == t ? _u(e, jt(e.value)) : _u(e, jt(t)) : n != null ? _u(e, jt(n)) : l != null && e.removeAttribute("value"), u == null && i != null && (e.defaultChecked = !!i), u != null && (e.checked = u && typeof u != "function" && typeof u != "symbol"), v != null && typeof v != "function" && typeof v != "symbol" && typeof v != "boolean" ? e.name = "" + jt(v) : e.removeAttribute("name");
  }
  function ia(e, t, n, l, u, i, s, v) {
    if (i != null && typeof i != "function" && typeof i != "symbol" && typeof i != "boolean" && (e.type = i), t != null || n != null) {
      if (!(i !== "submit" && i !== "reset" || t != null)) {
        jl(e);
        return;
      }
      n = n != null ? "" + jt(n) : "", t = t != null ? "" + jt(t) : n, v || t === e.value || (e.value = t), e.defaultValue = t;
    }
    l = l ?? u, l = typeof l != "function" && typeof l != "symbol" && !!l, e.checked = v ? e.checked : !!l, e.defaultChecked = !!l, s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" && (e.name = s), jl(e);
  }
  function _u(e, t) {
    e.defaultValue !== "" + t && (e.defaultValue = "" + t);
  }
  function bn(e, t, n, l) {
    if (e = e.options, t) {
      t = {};
      for (var u = 0; u < n.length; u++)
        t["$" + n[u]] = !0;
      for (n = 0; n < e.length; n++)
        u = t.hasOwnProperty("$" + e[n].value), e[n].selected !== u && (e[n].selected = u), u && l && (e[n].defaultSelected = !0);
    } else {
      for (n = "" + jt(n), t = null, u = 0; u < e.length; u++) {
        if (e[u].value === n) {
          e[u].selected = !0, l && (e[u].defaultSelected = !0);
          return;
        }
        t !== null || e[u].disabled || (t = e[u]);
      }
      t !== null && (t.selected = !0);
    }
  }
  function wu(e, t, n) {
    if (t != null && (t = "" + jt(t), t !== e.value && (e.value = t), n == null)) {
      e.defaultValue !== t && (e.defaultValue = t);
      return;
    }
    e.defaultValue = n != null ? "" + jt(n) : "";
  }
  function Nn(e, t, n, l) {
    if (t == null) {
      if (l != null) {
        if (n != null) throw Error(c(92));
        if (ye(l)) {
          if (1 < l.length) throw Error(c(93));
          l = l[0];
        }
        n = l;
      }
      n == null && (n = ""), t = n;
    }
    n = jt(t), e.defaultValue = n, l = e.textContent, l === n && l !== "" && l !== null && (e.value = l), jl(e);
  }
  function fn(e, t) {
    if (t) {
      var n = e.firstChild;
      if (n && n === e.lastChild && n.nodeType === 3) {
        n.nodeValue = t;
        return;
      }
    }
    e.textContent = t;
  }
  var ra = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function zi(e, t, n) {
    var l = t.indexOf("--") === 0;
    n == null || typeof n == "boolean" || n === "" ? l ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : l ? e.setProperty(t, n) : typeof n != "number" || n === 0 || ra.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
  }
  function zn(e, t, n) {
    if (t != null && typeof t != "object")
      throw Error(c(62));
    if (e = e.style, n != null) {
      for (var l in n)
        !n.hasOwnProperty(l) || t != null && t.hasOwnProperty(l) || (l.indexOf("--") === 0 ? e.setProperty(l, "") : l === "float" ? e.cssFloat = "" : e[l] = "", Ne = !0);
      for (var u in t)
        l = t[u], t.hasOwnProperty(u) && n[u] !== l && (zi(e, u, l), Ne = !0);
    } else
      for (var i in t)
        t.hasOwnProperty(i) && zi(e, i, t[i]);
  }
  function Qa(e) {
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
  var Mi = /* @__PURE__ */ new Map([
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
  ]), Di = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function Jt(e) {
    return Di.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
  }
  function dn() {
  }
  var Ka = null;
  function Ia(e) {
    return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
  }
  var We = null, Xt = null;
  function Gn(e) {
    var t = Xa(e);
    if (t && (e = t.stateNode)) {
      var n = e[kt] || null;
      e: switch (e = t.stateNode, t.type) {
        case "input":
          if (rn(
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
              'input[name="' + yt(
                "" + t
              ) + '"][type="radio"]'
            ), t = 0; t < n.length; t++) {
              var l = n[t];
              if (l !== e && l.form === e.form) {
                var u = l[kt] || null;
                if (!u) throw Error(c(90));
                rn(
                  l,
                  u.value,
                  u.defaultValue,
                  u.defaultValue,
                  u.checked,
                  u.defaultChecked,
                  u.type,
                  u.name
                );
              }
            }
            for (t = 0; t < n.length; t++)
              l = n[t], l.form === e.form && Du(l);
          }
          break e;
        case "textarea":
          wu(e, n.value, n.defaultValue);
          break e;
        case "select":
          t = n.value, t != null && bn(e, !!n.multiple, t, !1);
      }
    }
  }
  var Mn = !1;
  function Za(e, t, n) {
    if (Mn) return e(t, n);
    Mn = !0;
    try {
      var l = e(t);
      return l;
    } finally {
      if (Mn = !1, (We !== null || Xt !== null) && (Yo(), We && (t = We, e = Xt, Xt = We = null, Gn(t), e)))
        for (t = 0; t < e.length; t++) Gn(e[t]);
    }
  }
  function Ul(e, t) {
    var n = e.stateNode;
    if (n === null) return null;
    var l = n[kt] || null;
    if (l === null) return null;
    n = l[t];
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
        (l = !l.disabled) || (e = e.type, l = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !l;
        break e;
      default:
        e = !1;
    }
    if (e) return null;
    if (n && typeof n != "function")
      throw Error(
        c(231, t, typeof n)
      );
    return n;
  }
  var Ft = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), ka = !1;
  if (Ft)
    try {
      var _i = {};
      Object.defineProperty(_i, "passive", {
        get: function() {
          ka = !0;
        }
      }), window.addEventListener("test", _i, _i), window.removeEventListener("test", _i, _i);
    } catch {
      ka = !1;
    }
  var oa = null, Lc = null, Yr = null;
  function d0() {
    if (Yr) return Yr;
    var e, t = Lc, n = t.length, l, u = "value" in oa ? oa.value : oa.textContent, i = u.length;
    for (e = 0; e < n && t[e] === u[e]; e++) ;
    var s = n - e;
    for (l = 1; l <= s && t[n - l] === u[i - l]; l++) ;
    return Yr = u.slice(e, 1 < l ? 1 - l : void 0);
  }
  function Gr(e) {
    var t = e.keyCode;
    return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
  }
  function Xr() {
    return !0;
  }
  function v0() {
    return !1;
  }
  function vn(e) {
    function t(n, l, u, i, s) {
      this._reactName = n, this._targetInst = u, this.type = l, this.nativeEvent = i, this.target = s, this.currentTarget = null;
      for (var v in e)
        e.hasOwnProperty(v) && (n = e[v], this[v] = n ? n(i) : i[v]);
      return this.isDefaultPrevented = (i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1) ? Xr : v0, this.isPropagationStopped = v0, this;
    }
    return L(t.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var n = this.nativeEvent;
        n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = Xr);
      },
      stopPropagation: function() {
        var n = this.nativeEvent;
        n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = Xr);
      },
      persist: function() {
      },
      isPersistent: Xr
    }), t;
  }
  var ca = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(e) {
      return e.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, Qr = vn(ca), wi = L({}, ca, { view: 0, detail: 0 }), qp = vn(wi), Vc, qc, ji, Kr = L({}, wi, {
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
    getModifierState: Gc,
    button: 0,
    buttons: 0,
    relatedTarget: function(e) {
      return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
    },
    movementX: function(e) {
      return "movementX" in e ? e.movementX : (e !== ji && (ji && e.type === "mousemove" ? (Vc = e.screenX - ji.screenX, qc = e.screenY - ji.screenY) : qc = Vc = 0, ji = e), Vc);
    },
    movementY: function(e) {
      return "movementY" in e ? e.movementY : qc;
    }
  }), g0 = vn(Kr), Yp = L({}, Kr, { dataTransfer: 0 }), Gp = vn(Yp), Xp = L({}, wi, { relatedTarget: 0 }), Yc = vn(Xp), Qp = L({}, ca, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), Kp = vn(Qp), Ip = L({}, ca, {
    clipboardData: function(e) {
      return "clipboardData" in e ? e.clipboardData : window.clipboardData;
    }
  }), Zp = vn(Ip), kp = L({}, ca, { data: 0 }), m0 = vn(kp), Jp = {
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
  }, Fp = {
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
  }, Pp = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function Wp(e) {
    var t = this.nativeEvent;
    return t.getModifierState ? t.getModifierState(e) : (e = Pp[e]) ? !!t[e] : !1;
  }
  function Gc() {
    return Wp;
  }
  var $p = L({}, wi, {
    key: function(e) {
      if (e.key) {
        var t = Jp[e.key] || e.key;
        if (t !== "Unidentified") return t;
      }
      return e.type === "keypress" ? (e = Gr(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Fp[e.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: Gc,
    charCode: function(e) {
      return e.type === "keypress" ? Gr(e) : 0;
    },
    keyCode: function(e) {
      return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
    },
    which: function(e) {
      return e.type === "keypress" ? Gr(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
    }
  }), ey = vn($p), ty = L({}, Kr, {
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
  }), h0 = vn(ty), ny = L({}, ca, { submitter: 0 }), ly = vn(ny), ay = L({}, wi, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: Gc
  }), uy = vn(ay), iy = L({}, ca, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), ry = vn(iy), oy = L({}, Kr, {
    deltaX: function(e) {
      return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
    },
    deltaY: function(e) {
      return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), cy = vn(oy), sy = L({}, ca, {
    newState: 0,
    oldState: 0,
    source: 0
  }), fy = vn(sy), dy = [9, 13, 27, 32], Xc = Ft && "CompositionEvent" in window, Ui = null;
  Ft && "documentMode" in document && (Ui = document.documentMode);
  var vy = Ft && "TextEvent" in window && !Ui, p0 = Ft && (!Xc || Ui && 8 < Ui && 11 >= Ui), y0 = " ", b0 = !1;
  function S0(e, t) {
    switch (e) {
      case "keyup":
        return dy.indexOf(t.keyCode) !== -1;
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
  function E0(e) {
    return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
  }
  var ju = !1;
  function gy(e, t) {
    switch (e) {
      case "compositionend":
        return E0(t);
      case "keypress":
        return t.which !== 32 ? null : (b0 = !0, y0);
      case "textInput":
        return e = t.data, e === y0 && b0 ? null : e;
      default:
        return null;
    }
  }
  function my(e, t) {
    if (ju)
      return e === "compositionend" || !Xc && S0(e, t) ? (e = d0(), Yr = Lc = oa = null, ju = !1, e) : null;
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
        return p0 && t.locale !== "ko" ? null : t.data;
      default:
        return null;
    }
  }
  var hy = {
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
  function T0(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t === "input" ? !!hy[e.type] : t === "textarea";
  }
  function x0(e, t, n, l) {
    We ? Xt ? Xt.push(l) : Xt = [l] : We = l, t = Zo(t, "onChange"), 0 < t.length && (n = new Qr(
      "onChange",
      "change",
      null,
      n,
      l
    ), e.push({ event: n, listeners: t }));
  }
  var Hi = null, Bi = null;
  function py(e) {
    sm(e, 0);
  }
  function Ir(e) {
    var t = G(e);
    if (Du(t)) return e;
  }
  function C0(e, t) {
    if (e === "change") return t;
  }
  var R0 = !1;
  if (Ft) {
    var Qc;
    if (Ft) {
      var Kc = "oninput" in document;
      if (!Kc) {
        var A0 = document.createElement("div");
        A0.setAttribute("oninput", "return;"), Kc = typeof A0.oninput == "function";
      }
      Qc = Kc;
    } else Qc = !1;
    R0 = Qc && (!document.documentMode || 9 < document.documentMode);
  }
  function O0() {
    Hi && (Hi.detachEvent("onpropertychange", N0), Bi = Hi = null);
  }
  function N0(e) {
    if (e.propertyName === "value" && Ir(Bi)) {
      var t = [];
      x0(
        t,
        Bi,
        e,
        Ia(e)
      ), Za(py, t);
    }
  }
  function yy(e, t, n) {
    e === "focusin" ? (O0(), Hi = t, Bi = n, Hi.attachEvent("onpropertychange", N0)) : e === "focusout" && O0();
  }
  function by(e) {
    if (e === "selectionchange" || e === "keyup" || e === "keydown")
      return Ir(Bi);
  }
  function Sy(e, t) {
    if (e === "click") return Ir(t);
  }
  function Ey(e, t) {
    if (e === "input" || e === "change")
      return Ir(t);
  }
  function Ty(e, t) {
    return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
  }
  var Dn = typeof Object.is == "function" ? Object.is : Ty;
  function Li(e, t) {
    if (Dn(e, t)) return !0;
    if (typeof e != "object" || e === null || typeof t != "object" || t === null)
      return !1;
    var n = Object.keys(e), l = Object.keys(t);
    if (n.length !== l.length) return !1;
    for (l = 0; l < n.length; l++) {
      var u = n[l];
      if (!Ml.call(t, u) || !Dn(e[u], t[u]))
        return !1;
    }
    return !0;
  }
  function Ic(e) {
    if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u") return null;
    try {
      return e.activeElement || e.body;
    } catch {
      return e.body;
    }
  }
  function z0(e) {
    for (; e && e.firstChild; ) e = e.firstChild;
    return e;
  }
  function M0(e, t) {
    var n = z0(e);
    e = 0;
    for (var l; n; ) {
      if (n.nodeType === 3) {
        if (l = e + n.textContent.length, e <= t && l >= t)
          return { node: n, offset: t - e };
        e = l;
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
      n = z0(n);
    }
  }
  function D0(e, t) {
    return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? D0(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
  }
  function _0(e) {
    e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
    for (var t = Ic(e.document); t instanceof e.HTMLIFrameElement; ) {
      try {
        var n = typeof t.contentWindow.location.href == "string";
      } catch {
        n = !1;
      }
      if (n) e = t.contentWindow;
      else break;
      t = Ic(e.document);
    }
    return t;
  }
  function Zc(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
  }
  var xy = Ft && "documentMode" in document && 11 >= document.documentMode, Uu = null, kc = null, Vi = null, Jc = !1;
  function w0(e, t, n) {
    var l = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
    Jc || Uu == null || Uu !== Ic(l) || (l = Uu, "selectionStart" in l && Zc(l) ? l = { start: l.selectionStart, end: l.selectionEnd } : (l = (l.ownerDocument && l.ownerDocument.defaultView || window).getSelection(), l = {
      anchorNode: l.anchorNode,
      anchorOffset: l.anchorOffset,
      focusNode: l.focusNode,
      focusOffset: l.focusOffset
    }), Vi && Li(Vi, l) || (Vi = l, l = Zo(kc, "onSelect"), 0 < l.length && (t = new Qr(
      "onSelect",
      "select",
      null,
      t,
      n
    ), e.push({ event: t, listeners: l }), t.target = Uu)));
  }
  function Ja(e, t) {
    var n = {};
    return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
  }
  var Hu = {
    animationend: Ja("Animation", "AnimationEnd"),
    animationiteration: Ja("Animation", "AnimationIteration"),
    animationstart: Ja("Animation", "AnimationStart"),
    transitionrun: Ja("Transition", "TransitionRun"),
    transitionstart: Ja("Transition", "TransitionStart"),
    transitioncancel: Ja("Transition", "TransitionCancel"),
    transitionend: Ja("Transition", "TransitionEnd")
  }, Fc = {}, j0 = {};
  Ft && (j0 = document.createElement("div").style, "AnimationEvent" in window || (delete Hu.animationend.animation, delete Hu.animationiteration.animation, delete Hu.animationstart.animation), "TransitionEvent" in window || delete Hu.transitionend.transition);
  function Fa(e) {
    if (Fc[e]) return Fc[e];
    if (!Hu[e]) return e;
    var t = Hu[e], n;
    for (n in t)
      if (t.hasOwnProperty(n) && n in j0)
        return Fc[e] = t[n];
    return e;
  }
  var U0 = Fa("animationend"), H0 = Fa("animationiteration"), B0 = Fa("animationstart"), Cy = Fa("transitionrun"), Ry = Fa("transitionstart"), Ay = Fa("transitioncancel"), L0 = Fa("transitionend"), V0 = /* @__PURE__ */ new Map(), Pc = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  Pc.push("scrollEnd");
  function il(e, t) {
    V0.set(e, t), Qe(t, [e]);
  }
  var Oy = 0;
  function Hl(e, t) {
    if (e.name != null && e.name !== "auto") return e.name;
    if (t.autoName !== null) return t.autoName;
    e = sl.identifierPrefix;
    var n = Oy++;
    return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
  }
  function q0(e) {
    if (e == null || typeof e == "string")
      return e;
    var t = null, n = ni;
    if (n !== null)
      for (var l = 0; l < n.length; l++) {
        var u = e[n[l]];
        if (u != null) {
          if (u === "none") return "none";
          t = t == null ? u : t + (" " + u);
        }
      }
    return t ?? e.default;
  }
  function Bl(e, t) {
    return e = q0(e), t = q0(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
  }
  var Zr = typeof reportError == "function" ? reportError : function(e) {
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
  }, Xn = [], Bu = 0, Wc = 0;
  function kr() {
    for (var e = Bu, t = Wc = Bu = 0; t < e; ) {
      var n = Xn[t];
      Xn[t++] = null;
      var l = Xn[t];
      Xn[t++] = null;
      var u = Xn[t];
      Xn[t++] = null;
      var i = Xn[t];
      if (Xn[t++] = null, l !== null && u !== null) {
        var s = l.pending;
        s === null ? u.next = u : (u.next = s.next, s.next = u), l.pending = u;
      }
      i !== 0 && Y0(n, u, i);
    }
  }
  function Jr(e, t, n, l) {
    Xn[Bu++] = e, Xn[Bu++] = t, Xn[Bu++] = n, Xn[Bu++] = l, Wc |= l, e.lanes |= l, e = e.alternate, e !== null && (e.lanes |= l);
  }
  function $c(e, t, n, l) {
    return Jr(e, t, n, l), Fr(e);
  }
  function Pa(e, t) {
    return Jr(e, null, null, t), Fr(e);
  }
  function Y0(e, t, n) {
    e.lanes |= n;
    var l = e.alternate;
    l !== null && (l.lanes |= n);
    for (var u = !1, i = e.return; i !== null; )
      i.childLanes |= n, l = i.alternate, l !== null && (l.childLanes |= n), i.tag === 22 && (e = i.stateNode, e === null || e._visibility & 1 || (u = !0)), e = i, i = i.return;
    return e.tag === 3 ? (i = e.stateNode, u && t !== null && (u = 31 - Gt(n), e = i.hiddenUpdates, l = e[u], l === null ? e[u] = [t] : l.push(t), t.lane = n | 536870912), i) : null;
  }
  function Fr(e) {
    if (50 < rr)
      throw rr = 0, qo = null, Error(c(185));
    for (var t = e.return; t !== null; )
      e = t, t = e.return;
    return e.tag === 3 ? e.stateNode : null;
  }
  var Lu = {};
  function Ny(e, t, n, l) {
    this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function Sn(e, t, n, l) {
    return new Ny(e, t, n, l);
  }
  function es(e) {
    return e = e.prototype, !(!e || !e.isReactComponent);
  }
  function Ll(e, t) {
    var n = e.alternate;
    return n === null ? (n = Sn(
      e.tag,
      t,
      e.key,
      e.mode
    ), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
  }
  function G0(e, t) {
    e.flags &= 1206910978;
    var n = e.alternate;
    return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
      lanes: t.lanes,
      firstContext: t.firstContext
    }), e;
  }
  function Pr(e, t, n, l, u, i) {
    var s = 0;
    if (l = e, typeof l == "function") es(l) && (s = 1);
    else if (typeof l == "string")
      s = n1(
        e,
        n,
        Te.current
      ) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
    else
      e: switch (l) {
        case ze:
          return e = Sn(31, n, t, u), e.elementType = ze, e.lanes = i, e;
        case K:
          return Wa(n.children, u, i, t);
        case te:
          s = 8, u |= 24;
          break;
        case fe:
          return e = Sn(12, n, t, u | 2), e.elementType = fe, e.lanes = i, e;
        case ce:
          return e = Sn(13, n, t, u), e.elementType = ce, e.lanes = i, e;
        case ne:
          return e = Sn(19, n, t, u), e.elementType = ne, e.lanes = i, e;
        case pe:
        case E:
          return e = u | 32, e = Sn(30, n, t, e), e.elementType = E, e.lanes = i, e.stateNode = {
            autoName: null,
            paired: null,
            clones: null,
            ref: null
          }, e;
        default:
          if (typeof l == "object" && l !== null)
            switch (l.$$typeof) {
              case oe:
                s = 10;
                break e;
              case ae:
                s = 9;
                break e;
              case I:
                s = 11;
                break e;
              case ie:
                s = 14;
                break e;
              case W:
                s = 16, l = null;
                break e;
            }
          s = 29, n = Error(
            c(130, e === null ? "null" : typeof e, "")
          ), l = null;
      }
    return t = Sn(s, n, t, u), t.elementType = e, t.type = l, t.lanes = i, t;
  }
  function Wa(e, t, n, l) {
    return e = Sn(7, e, l, t), e.lanes = n, e;
  }
  function ts(e, t, n) {
    return e = Sn(6, e, null, t), e.lanes = n, e;
  }
  function X0(e) {
    var t = Sn(18, null, null, 0);
    return t.stateNode = e, t;
  }
  function ns(e, t, n) {
    return t = Sn(
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
  var Q0 = /* @__PURE__ */ new WeakMap();
  function Qn(e, t) {
    if (typeof e == "object" && e !== null) {
      var n = Q0.get(e);
      return n !== void 0 ? n : (t = {
        value: e,
        source: t,
        stack: $n(t)
      }, Q0.set(e, t), t);
    }
    return {
      value: e,
      source: t,
      stack: $n(t)
    };
  }
  var Vu = [], qu = 0, Wr = null, qi = 0, Kn = [], In = 0, sa = null, hl = 1, pl = "";
  function Vl(e, t) {
    Vu[qu++] = qi, Vu[qu++] = Wr, Wr = e, qi = t;
  }
  function K0(e, t, n) {
    Kn[In++] = hl, Kn[In++] = pl, Kn[In++] = sa, sa = e;
    var l = hl;
    e = pl;
    var u = 32 - Gt(l) - 1;
    l &= ~(1 << u), n += 1;
    var i = 32 - Gt(t) + u;
    if (30 < i) {
      var s = u - u % 5;
      i = (l & (1 << s) - 1).toString(32), l >>= s, u -= s, hl = 1 << 32 - Gt(t) + u | n << u | l, pl = i + e;
    } else
      hl = 1 << i | n << u | l, pl = e;
  }
  function $r(e) {
    e.return !== null && (Vl(e, 1), K0(e, 1, 0));
  }
  function ls(e) {
    for (; e === Wr; )
      Wr = Vu[--qu], Vu[qu] = null, qi = Vu[--qu], Vu[qu] = null;
    for (; e === sa; )
      sa = Kn[--In], Kn[In] = null, pl = Kn[--In], Kn[In] = null, hl = Kn[--In], Kn[In] = null;
  }
  function I0(e, t) {
    Kn[In++] = hl, Kn[In++] = pl, Kn[In++] = sa, hl = t.id, pl = t.overflow, sa = e;
  }
  var Qt = null, ht = null, Ke = !1, fa = null, Zn = !1, as = Error(c(519));
  function da(e) {
    var t = Error(
      c(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw Yi(Qn(t, e)), as;
  }
  function Z0(e) {
    var t = e.stateNode, n = e.type, l = e.memoizedProps;
    switch (t[Tt] = e, t[kt] = l, n) {
      case "dialog":
        ke("cancel", t), ke("close", t);
        break;
      case "iframe":
      case "object":
      case "embed":
        ke("load", t);
        break;
      case "video":
      case "audio":
        for (n = 0; n < cr.length; n++)
          ke(cr[n], t);
        break;
      case "source":
        ke("error", t);
        break;
      case "img":
      case "image":
      case "link":
        ke("error", t), ke("load", t);
        break;
      case "details":
        ke("toggle", t);
        break;
      case "input":
        ke("invalid", t), ia(
          t,
          l.value,
          l.defaultValue,
          l.checked,
          l.defaultChecked,
          l.type,
          l.name,
          !0
        );
        break;
      case "select":
        ke("invalid", t);
        break;
      case "textarea":
        ke("invalid", t), Nn(t, l.value, l.defaultValue, l.children);
    }
    n = l.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || l.suppressHydrationWarning === !0 || gm(t.textContent, n) ? (l.popover != null && (ke("beforetoggle", t), ke("toggle", t)), l.onScroll != null && ke("scroll", t), l.onScrollEnd != null && ke("scrollend", t), l.onClick != null && (t.onclick = dn), t = !0) : t = !1, t || da(e, !0);
  }
  function eo(e) {
    for (Qt = e.return; Qt; )
      switch (Qt.tag) {
        case 5:
        case 31:
        case 13:
          Zn = !1;
          return;
        case 27:
        case 3:
          Zn = !0;
          return;
        default:
          Qt = Qt.return;
      }
  }
  function Yu(e) {
    if (e !== Qt) return !1;
    if (!Ke) return eo(e), Ke = !0, !1;
    var t = e.tag, n;
    if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = !(n !== "form" && n !== "button") || Uf(e.type, e.memoizedProps)), n = !n), n && ht && da(e), eo(e), t === 13) {
      if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(c(317));
      ht = wm(e);
    } else if (t === 31) {
      if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(c(317));
      ht = wm(e);
    } else
      t === 27 ? (t = ht, Na(e.type) ? (e = Qf, Qf = null, ht = e) : ht = t) : ht = Qt ? Jn(e.stateNode.nextSibling) : null;
    return !0;
  }
  function $a() {
    ht = Qt = null, Ke = !1;
  }
  function us() {
    var e = fa;
    return e !== null && (xn === null ? xn = e : xn.push.apply(
      xn,
      e
    ), fa = null), e;
  }
  function Yi(e) {
    fa === null ? fa = [e] : fa.push(e);
  }
  var is = be(null), eu = null, ql = null;
  function va(e, t, n) {
    Be(is, t._currentValue), t._currentValue = n;
  }
  function Yl(e) {
    e._currentValue = is.current, _e(is);
  }
  function to(e, t, n) {
    for (; e !== null; ) {
      var l = e.alternate;
      if ((e.childLanes & t) !== t ? (e.childLanes |= t, l !== null && (l.childLanes |= t)) : l !== null && (l.childLanes & t) !== t && (l.childLanes |= t), e === n) break;
      e = e.return;
    }
  }
  function rs(e, t, n, l) {
    var u = e.child;
    for (u !== null && (u.return = e); u !== null; ) {
      var i = u.dependencies;
      if (i !== null) {
        var s = u.child;
        i = i.firstContext;
        e: for (; i !== null; ) {
          var v = i;
          i = u;
          for (var T = 0; T < t.length; T++)
            if (v.context === t[T]) {
              i.lanes |= n, v = i.alternate, v !== null && (v.lanes |= n), to(
                i.return,
                n,
                e
              ), l || (s = null);
              break e;
            }
          i = v.next;
        }
      } else if (u.tag === 18) {
        if (s = u.return, s === null) throw Error(c(341));
        s.lanes |= n, i = s.alternate, i !== null && (i.lanes |= n), to(s, n, e), s = null;
      } else
        u.tag === 13 && u.memoizedState !== null && u.memoizedState.dehydrated === null ? (u.lanes |= n, s = u.alternate, s !== null && (s.lanes |= n), to(
          u.return,
          n,
          e
        ), s = u.child, s = s !== null ? s.sibling : null) : s = u.child;
      if (s !== null) s.return = u;
      else
        for (s = u; s !== null; ) {
          if (s === e) {
            s = null;
            break;
          }
          if (u = s.sibling, u !== null) {
            u.return = s.return, s = u;
            break;
          }
          s = s.return;
        }
      u = s;
    }
  }
  function tu(e, t, n, l) {
    e = null;
    for (var u = t, i = !1; u !== null; ) {
      if (!i) {
        if ((u.flags & 524288) !== 0) i = !0;
        else if ((u.flags & 262144) !== 0) break;
      }
      if (u.tag === 10) {
        var s = u.alternate;
        if (s === null) throw Error(c(387));
        if (s = s.memoizedProps, s !== null) {
          var v = u.type;
          Dn(u.pendingProps.value, s.value) || (e !== null ? e.push(v) : e = [v]);
        }
      } else if (u === at.current) {
        if (s = u.alternate, s === null) throw Error(c(387));
        s.memoizedState.memoizedState !== u.memoizedState.memoizedState && (e !== null ? e.push(di) : e = [di]);
      }
      u = u.return;
    }
    return e !== null && rs(
      t,
      e,
      n,
      l
    ), t.flags |= 262144, e !== null;
  }
  function no(e) {
    for (e = e.firstContext; e !== null; ) {
      if (!Dn(
        e.context._currentValue,
        e.memoizedValue
      ))
        return !0;
      e = e.next;
    }
    return !1;
  }
  function nu(e) {
    eu = e, ql = null, e = e.dependencies, e !== null && (e.firstContext = null);
  }
  function Pt(e) {
    return k0(eu, e);
  }
  function lo(e, t) {
    return eu === null && nu(e), k0(e, t);
  }
  function k0(e, t) {
    var n = t._currentValue;
    if (t = { context: t, memoizedValue: n, next: null }, ql === null) {
      if (e === null) throw Error(c(308));
      ql = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
    } else ql = ql.next = t;
    return n;
  }
  var zy = typeof AbortController < "u" ? AbortController : function() {
    var e = [], t = this.signal = {
      aborted: !1,
      addEventListener: function(n, l) {
        e.push(l);
      }
    };
    this.abort = function() {
      t.aborted = !0, e.forEach(function(n) {
        return n();
      });
    };
  }, My = a.unstable_scheduleCallback, Dy = a.unstable_NormalPriority, Ut = {
    $$typeof: oe,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function os() {
    return {
      controller: new zy(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function Gi(e) {
    e.refCount--, e.refCount === 0 && My(Dy, function() {
      e.controller.abort();
    });
  }
  function J0(e, t) {
    if ((e.pendingLanes & 4194048) !== 0) {
      var n = e.transitionTypes;
      for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
        var l = t[e];
        n.indexOf(l) === -1 && n.push(l);
      }
    }
  }
  var Xi = null;
  function _y(e) {
    var t = e.transitionTypes;
    return e.transitionTypes = null, t;
  }
  var Qi = null, cs = 0, lu = 0, Gu = null;
  function wy(e, t) {
    if (Qi === null) {
      var n = Qi = [];
      cs = 0, lu = Af(), Gu = {
        status: "pending",
        value: void 0,
        then: function(l) {
          n.push(l);
        }
      };
    }
    return cs++, t.then(F0, F0), t;
  }
  function F0() {
    if (--cs === 0 && (Xi = null, Qi !== null)) {
      Gu !== null && (Gu.status = "fulfilled");
      var e = Qi;
      Qi = null, lu = 0, Gu = null;
      for (var t = 0; t < e.length; t++) (0, e[t])();
    }
  }
  function jy(e, t) {
    var n = [], l = {
      status: "pending",
      value: null,
      reason: null,
      then: function(u) {
        n.push(u);
      }
    };
    return e.then(
      function() {
        l.status = "fulfilled", l.value = t;
        for (var u = 0; u < n.length; u++) (0, n[u])(t);
      },
      function(u) {
        for (l.status = "rejected", l.reason = u, u = 0; u < n.length; u++)
          (0, n[u])(void 0);
      }
    ), l;
  }
  var P0 = se.S;
  se.S = function(e, t) {
    if (Xg = Zt(), typeof t == "object" && t !== null && typeof t.then == "function" && wy(e, t), Xi !== null)
      for (var n = ii; n !== null; )
        J0(n, Xi), n = n.next;
    if (n = e.types, n !== null) {
      for (var l = ii; l !== null; )
        J0(l, n), l = l.next;
      if (lu !== 0) {
        l = Xi, l === null && (l = Xi = []);
        for (var u = 0; u < n.length; u++) {
          var i = n[u];
          l.indexOf(i) === -1 && l.push(i);
        }
      }
    }
    P0 !== null && P0(e, t);
  };
  var au = be(null);
  function ss() {
    var e = au.current;
    return e !== null ? e : gt.pooledCache;
  }
  function ao(e, t) {
    t === null ? Be(au, au.current) : Be(au, t.pool);
  }
  function W0() {
    var e = ss();
    return e === null ? null : { parent: Ut._currentValue, pool: e };
  }
  var Xu = Error(c(460)), fs = Error(c(474)), uo = Error(c(542)), io = { then: function() {
  } };
  function $0(e) {
    return e = e.status, e === "fulfilled" || e === "rejected";
  }
  function ev(e, t, n) {
    switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(dn, dn), t = n), t.status) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw e = t.reason, nv(e), e === void 0 && !("reason" in t) ? Error(c(600)) : e;
      default:
        if (typeof t.status == "string") t.then(dn, dn);
        else {
          if (e = gt, e !== null && 100 < e.shellSuspendCounter)
            throw Error(c(482));
          e = t, e.status = "pending", e.then(
            function(l) {
              if (t.status === "pending") {
                var u = t;
                u.status = "fulfilled", u.value = l;
              }
            },
            function(l) {
              if (t.status === "pending") {
                var u = t;
                u.status = "rejected", u.reason = l;
              }
            }
          );
        }
        switch (t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, nv(e), e;
        }
        throw iu = t, Xu;
    }
  }
  function uu(e) {
    try {
      var t = e._init;
      return t(e._payload);
    } catch (n) {
      throw n !== null && typeof n == "object" && typeof n.then == "function" ? (iu = n, Xu) : n;
    }
  }
  var iu = null;
  function tv() {
    if (iu === null) throw Error(c(459));
    var e = iu;
    return iu = null, e;
  }
  function nv(e) {
    if (e === Xu || e === uo)
      throw Error(c(483));
  }
  var Qu = null, Ki = 0;
  function ro(e) {
    var t = Ki;
    return Ki += 1, Qu === null && (Qu = []), ev(Qu, e, t);
  }
  function ga(e, t) {
    t = t.props.ref, e.ref = t !== void 0 ? t : null;
  }
  function oo(e, t) {
    throw t.$$typeof === V ? Error(c(525)) : (e = Object.prototype.toString.call(t), Error(
      c(
        31,
        e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
      )
    ));
  }
  function lv(e) {
    function t(D, C) {
      if (e) {
        var H = D.deletions;
        H === null ? (D.deletions = [C], D.flags |= 16) : H.push(C);
      }
    }
    function n(D, C) {
      if (!e) return null;
      for (; C !== null; )
        t(D, C), C = C.sibling;
      return null;
    }
    function l(D) {
      for (var C = /* @__PURE__ */ new Map(); D !== null; )
        D.key === null ? C.set(D.index, D) : C.set(D.key, D), D = D.sibling;
      return C;
    }
    function u(D, C) {
      return D = Ll(D, C), D.index = 0, D.sibling = null, D;
    }
    function i(D, C, H) {
      return D.index = H, e ? (H = D.alternate, H !== null ? (H = H.index, H < C ? (D.flags |= 2, C) : H) : (D.flags |= 134217730, C)) : (D.flags |= 1048576, C);
    }
    function s(D) {
      return e && D.alternate === null && (D.flags |= 134217730), D;
    }
    function v(D, C, H, k) {
      return C === null || C.tag !== 6 ? (C = ts(H, D.mode, k), C.return = D, C) : (C = u(C, H), C.return = D, C);
    }
    function T(D, C, H, k) {
      var he = H.type;
      return he === K ? (D = X(
        D,
        C,
        H.props.children,
        k,
        H.key
      ), ga(D, H), D) : C !== null && (C.elementType === he || typeof he == "object" && he !== null && he.$$typeof === W && uu(he) === C.type) ? (C = u(C, H.props), ga(C, H), C.return = D, C) : (C = Pr(
        H.type,
        H.key,
        H.props,
        null,
        D.mode,
        k
      ), ga(C, H), C.return = D, C);
    }
    function w(D, C, H, k) {
      return C === null || C.tag !== 4 || C.stateNode.containerInfo !== H.containerInfo || C.stateNode.implementation !== H.implementation ? (C = ns(H, D.mode, k), C.return = D, C) : (C = u(C, H.children || []), C.return = D, C);
    }
    function X(D, C, H, k, he) {
      return C === null || C.tag !== 7 ? (C = Wa(
        H,
        D.mode,
        k,
        he
      ), C.return = D, C) : (C = u(C, H), C.return = D, C);
    }
    function J(D, C, H) {
      if (typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint")
        return C = ts(
          "" + C,
          D.mode,
          H
        ), C.return = D, C;
      if (typeof C == "object" && C !== null) {
        switch (C.$$typeof) {
          case P:
            return H = Pr(
              C.type,
              C.key,
              C.props,
              null,
              D.mode,
              H
            ), ga(H, C), H.return = D, H;
          case Z:
            return C = ns(
              C,
              D.mode,
              H
            ), C.return = D, C;
          case W:
            return C = uu(C), J(D, C, H);
        }
        if (ye(C) || re(C))
          return C = Wa(
            C,
            D.mode,
            H,
            null
          ), C.return = D, C;
        if (typeof C.then == "function")
          return J(D, ro(C), H);
        if (C.$$typeof === oe)
          return J(
            D,
            lo(D, C),
            H
          );
        oo(D, C);
      }
      return null;
    }
    function z(D, C, H, k) {
      var he = C !== null ? C.key : null;
      if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
        return he !== null ? null : v(D, C, "" + H, k);
      if (typeof H == "object" && H !== null) {
        switch (H.$$typeof) {
          case P:
            return H.key === he ? T(D, C, H, k) : null;
          case Z:
            return H.key === he ? w(D, C, H, k) : null;
          case W:
            return H = uu(H), z(D, C, H, k);
        }
        if (ye(H) || re(H))
          return he !== null ? null : X(D, C, H, k, null);
        if (typeof H.then == "function")
          return z(
            D,
            C,
            ro(H),
            k
          );
        if (H.$$typeof === oe)
          return z(
            D,
            C,
            lo(D, H),
            k
          );
        oo(D, H);
      }
      return null;
    }
    function B(D, C, H, k, he) {
      if (typeof k == "string" && k !== "" || typeof k == "number" || typeof k == "bigint")
        return D = D.get(H) || null, v(C, D, "" + k, he);
      if (typeof k == "object" && k !== null) {
        switch (k.$$typeof) {
          case P:
            return D = D.get(
              k.key === null ? H : k.key
            ) || null, T(C, D, k, he);
          case Z:
            return D = D.get(
              k.key === null ? H : k.key
            ) || null, w(C, D, k, he);
          case W:
            return k = uu(k), B(
              D,
              C,
              H,
              k,
              he
            );
        }
        if (ye(k) || re(k))
          return D = D.get(H) || null, X(C, D, k, he, null);
        if (typeof k.then == "function")
          return B(
            D,
            C,
            H,
            ro(k),
            he
          );
        if (k.$$typeof === oe)
          return B(
            D,
            C,
            H,
            lo(C, k),
            he
          );
        oo(C, k);
      }
      return null;
    }
    function de(D, C, H, k) {
      for (var he = null, Pe = null, Ce = C, we = C = 0, Lt = null; Ce !== null && we < H.length; we++) {
        Ce.index > we ? (Lt = Ce, Ce = null) : Lt = Ce.sibling;
        var $e = z(
          D,
          Ce,
          H[we],
          k
        );
        if ($e === null) {
          Ce === null && (Ce = Lt);
          break;
        }
        e && Ce && $e.alternate === null && t(D, Ce), C = i($e, C, we), Pe === null ? he = $e : Pe.sibling = $e, Pe = $e, Ce = Lt;
      }
      if (we === H.length)
        return n(D, Ce), Ke && Vl(D, we), he;
      if (Ce === null) {
        for (; we < H.length; we++)
          Ce = J(D, H[we], k), Ce !== null && (C = i(
            Ce,
            C,
            we
          ), Pe === null ? he = Ce : Pe.sibling = Ce, Pe = Ce);
        return Ke && Vl(D, we), he;
      }
      for (Ce = l(Ce); we < H.length; we++)
        Lt = B(
          Ce,
          D,
          we,
          H[we],
          k
        ), Lt !== null && (e && ($e = Lt.alternate, $e !== null && Ce.delete($e.key === null ? we : $e.key)), C = i(
          Lt,
          C,
          we
        ), Pe === null ? he = Lt : Pe.sibling = Lt, Pe = Lt);
      return e && Ce.forEach(function(wa) {
        return t(D, wa);
      }), Ke && Vl(D, we), he;
    }
    function Ee(D, C, H, k) {
      if (H == null) throw Error(c(151));
      for (var he = null, Pe = null, Ce = C, we = C = 0, Lt = null, $e = H.next(); Ce !== null && !$e.done; we++, $e = H.next()) {
        Ce.index > we ? (Lt = Ce, Ce = null) : Lt = Ce.sibling;
        var wa = z(D, Ce, $e.value, k);
        if (wa === null) {
          Ce === null && (Ce = Lt);
          break;
        }
        e && Ce && wa.alternate === null && t(D, Ce), C = i(wa, C, we), Pe === null ? he = wa : Pe.sibling = wa, Pe = wa, Ce = Lt;
      }
      if ($e.done)
        return n(D, Ce), Ke && Vl(D, we), he;
      if (Ce === null) {
        for (; !$e.done; we++, $e = H.next())
          $e = J(D, $e.value, k), $e !== null && (C = i($e, C, we), Pe === null ? he = $e : Pe.sibling = $e, Pe = $e);
        return Ke && Vl(D, we), he;
      }
      for (Ce = l(Ce); !$e.done; we++, $e = H.next())
        $e = B(Ce, D, we, $e.value, k), $e !== null && (e && (Lt = $e.alternate, Lt !== null && Ce.delete(
          Lt.key === null ? we : Lt.key
        )), C = i($e, C, we), Pe === null ? he = $e : Pe.sibling = $e, Pe = $e);
      return e && Ce.forEach(function(g1) {
        return t(D, g1);
      }), Ke && Vl(D, we), he;
    }
    function Ge(D, C, H, k) {
      if (typeof H == "object" && H !== null && H.type === K && H.key === null && H.props.ref === void 0 && (H = H.props.children), typeof H == "object" && H !== null) {
        switch (H.$$typeof) {
          case P:
            e: {
              for (var he = H.key; C !== null; ) {
                if (C.key === he) {
                  if (he = H.type, he === K) {
                    if (C.tag === 7) {
                      n(
                        D,
                        C.sibling
                      ), k = u(
                        C,
                        H.props.children
                      ), ga(k, H), k.return = D, D = k;
                      break e;
                    }
                  } else if (C.elementType === he || typeof he == "object" && he !== null && he.$$typeof === W && uu(he) === C.type) {
                    n(
                      D,
                      C.sibling
                    ), k = u(C, H.props), ga(k, H), k.return = D, D = k;
                    break e;
                  }
                  n(D, C);
                  break;
                } else t(D, C);
                C = C.sibling;
              }
              H.type === K ? (k = Wa(
                H.props.children,
                D.mode,
                k,
                H.key
              ), ga(k, H), k.return = D, D = k) : (k = Pr(
                H.type,
                H.key,
                H.props,
                null,
                D.mode,
                k
              ), ga(k, H), k.return = D, D = k);
            }
            return s(D);
          case Z:
            e: {
              for (he = H.key; C !== null; ) {
                if (C.key === he)
                  if (C.tag === 4 && C.stateNode.containerInfo === H.containerInfo && C.stateNode.implementation === H.implementation) {
                    n(
                      D,
                      C.sibling
                    ), k = u(C, H.children || []), k.return = D, D = k;
                    break e;
                  } else {
                    n(D, C);
                    break;
                  }
                else t(D, C);
                C = C.sibling;
              }
              k = ns(H, D.mode, k), k.return = D, D = k;
            }
            return s(D);
          case W:
            return H = uu(H), Ge(
              D,
              C,
              H,
              k
            );
        }
        if (ye(H))
          return de(
            D,
            C,
            H,
            k
          );
        if (re(H)) {
          if (he = re(H), typeof he != "function") throw Error(c(150));
          return H = he.call(H), Ee(
            D,
            C,
            H,
            k
          );
        }
        if (typeof H.then == "function")
          return Ge(
            D,
            C,
            ro(H),
            k
          );
        if (H.$$typeof === oe)
          return Ge(
            D,
            C,
            lo(D, H),
            k
          );
        oo(D, H);
      }
      return typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint" ? (H = "" + H, C !== null && C.tag === 6 ? (n(D, C.sibling), k = u(C, H), k.return = D, D = k) : (n(D, C), k = ts(H, D.mode, k), k.return = D, D = k), s(D)) : n(D, C);
    }
    return function(D, C, H, k) {
      try {
        Ki = 0;
        var he = Ge(
          D,
          C,
          H,
          k
        );
        return Qu = null, he;
      } catch (Ce) {
        if (Ce === Xu || Ce === uo) throw Ce;
        var Pe = Sn(29, Ce, null, D.mode);
        return Pe.lanes = k, Pe.return = D, Pe;
      }
    };
  }
  var ru = lv(!0), av = lv(!1), ma = !1;
  function ds(e) {
    e.updateQueue = {
      baseState: e.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function vs(e, t) {
    e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
      baseState: e.baseState,
      firstBaseUpdate: e.firstBaseUpdate,
      lastBaseUpdate: e.lastBaseUpdate,
      shared: e.shared,
      callbacks: null
    });
  }
  function ha(e) {
    return { lane: e, tag: 0, payload: null, callback: null, next: null };
  }
  function pa(e, t, n) {
    var l = e.updateQueue;
    if (l === null) return null;
    if (l = l.shared, (lt & 2) !== 0) {
      var u = l.pending;
      return u === null ? t.next = t : (t.next = u.next, u.next = t), l.pending = t, t = Fr(e), Y0(e, null, n), t;
    }
    return Jr(e, l, t, n), Fr(e);
  }
  function Ii(e, t, n) {
    if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194048) !== 0)) {
      var l = t.lanes;
      l &= e.pendingLanes, n |= l, t.lanes = n, Ru(e, n);
    }
  }
  function gs(e, t) {
    var n = e.updateQueue, l = e.alternate;
    if (l !== null && (l = l.updateQueue, n === l)) {
      var u = null, i = null;
      if (n = n.firstBaseUpdate, n !== null) {
        do {
          var s = {
            lane: n.lane,
            tag: n.tag,
            payload: n.payload,
            callback: null,
            next: null
          };
          i === null ? u = i = s : i = i.next = s, n = n.next;
        } while (n !== null);
        i === null ? u = i = t : i = i.next = t;
      } else u = i = t;
      n = {
        baseState: l.baseState,
        firstBaseUpdate: u,
        lastBaseUpdate: i,
        shared: l.shared,
        callbacks: l.callbacks
      }, e.updateQueue = n;
      return;
    }
    e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
  }
  var ms = !1;
  function Zi() {
    if (ms) {
      var e = Gu;
      if (e !== null) throw e;
    }
  }
  function ki(e, t, n, l) {
    ms = !1;
    var u = e.updateQueue;
    ma = !1;
    var i = u.firstBaseUpdate, s = u.lastBaseUpdate, v = u.shared.pending;
    if (v !== null) {
      u.shared.pending = null;
      var T = v, w = T.next;
      T.next = null, s === null ? i = w : s.next = w, s = T;
      var X = e.alternate;
      X !== null && (X = X.updateQueue, v = X.lastBaseUpdate, v !== s && (v === null ? X.firstBaseUpdate = w : v.next = w, X.lastBaseUpdate = T));
    }
    if (i !== null) {
      var J = u.baseState;
      s = 0, X = w = T = null, v = i;
      do {
        var z = v.lane & -536870913, B = z !== v.lane;
        if (B ? (Fe & z) === z : (l & z) === z) {
          z !== 0 && z === lu && (ms = !0), X !== null && (X = X.next = {
            lane: 0,
            tag: v.tag,
            payload: v.payload,
            callback: null,
            next: null
          });
          e: {
            var de = e, Ee = v;
            z = t;
            var Ge = n;
            switch (Ee.tag) {
              case 1:
                if (de = Ee.payload, typeof de == "function") {
                  J = de.call(Ge, J, z);
                  break e;
                }
                J = de;
                break e;
              case 3:
                de.flags = de.flags & -65537 | 128;
              case 0:
                if (de = Ee.payload, z = typeof de == "function" ? de.call(Ge, J, z) : de, z == null) break e;
                J = L({}, J, z);
                break e;
              case 2:
                ma = !0;
            }
          }
          z = v.callback, z !== null && (e.flags |= 64, B && (e.flags |= 8192), B = u.callbacks, B === null ? u.callbacks = [z] : B.push(z));
        } else
          B = {
            lane: z,
            tag: v.tag,
            payload: v.payload,
            callback: v.callback,
            next: null
          }, X === null ? (w = X = B, T = J) : X = X.next = B, s |= z;
        if (v = v.next, v === null) {
          if (v = u.shared.pending, v === null)
            break;
          B = v, v = B.next, B.next = null, u.lastBaseUpdate = B, u.shared.pending = null;
        }
      } while (!0);
      X === null && (T = J), u.baseState = T, u.firstBaseUpdate = w, u.lastBaseUpdate = X, i === null && (u.shared.lanes = 0), Ca |= s, e.lanes = s, e.memoizedState = J;
    }
  }
  function uv(e, t) {
    if (typeof e != "function")
      throw Error(c(191, e));
    e.call(t);
  }
  function iv(e, t) {
    var n = e.callbacks;
    if (n !== null)
      for (e.callbacks = null, e = 0; e < n.length; e++)
        uv(n[e], t);
  }
  var ya = be(null), co = be(0);
  function rv(e, t) {
    e = Il, Be(co, e), Be(ya, t), Il = e | t.baseLanes;
  }
  function hs() {
    Be(co, Il), Be(ya, ya.current);
  }
  function ps() {
    Il = co.current, _e(ya), _e(co);
  }
  var Wt = be(null), on = null;
  function ba(e) {
    var t = e.alternate;
    Be($t, $t.current & 1), Be(Wt, e), on === null && (t === null || ya.current !== null || t.memoizedState !== null) && (on = e);
  }
  function ys(e) {
    Be($t, $t.current), Be(Wt, e), on === null && (on = e);
  }
  function ov(e) {
    e.tag === 22 ? (Be($t, $t.current), Be(Wt, e), on === null && (on = e)) : Sa();
  }
  function Sa() {
    Be($t, $t.current), Be(Wt, Wt.current);
  }
  function _n(e) {
    _e(Wt), on === e && (on = null), _e($t);
  }
  var $t = be(0);
  function Ji(e, t) {
    Be(Wt, Wt.current), Be($t, t);
  }
  function bs(e) {
    _e($t), _e(Wt), on === e && (on = null);
  }
  function so(e) {
    for (var t = e; t !== null; ) {
      if (t.tag === 13) {
        var n = t.memoizedState;
        if (n !== null && (n = n.dehydrated, n === null || Gf(n) || Xf(n)))
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
  var Gl = 0, Ye = null, vt = null, Ht = null, fo = !1, Ku = !1, ou = !1, vo = 0, Fi = 0, Iu = null, Uy = 0;
  function At() {
    throw Error(c(321));
  }
  function Ss(e, t) {
    if (t === null) return !1;
    for (var n = 0; n < t.length && n < e.length; n++)
      if (!Dn(e[n], t[n])) return !1;
    return !0;
  }
  function Es(e, t, n, l, u, i) {
    return Gl = i, Ye = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, se.H = e === null || e.memoizedState === null ? Kv : Iv, ou = !1, i = n(l, u), ou = !1, Ku && (i = sv(
      t,
      n,
      l,
      u
    )), cv(e), i;
  }
  function cv(e) {
    se.H = So;
    var t = vt !== null && vt.next !== null;
    if (Gl = 0, Ht = vt = Ye = null, fo = !1, Fi = 0, Iu = null, t) throw Error(c(300));
    e === null || Bt || (e = e.dependencies, e !== null && no(e) && (Bt = !0));
  }
  function sv(e, t, n, l) {
    Ye = e;
    var u = 0;
    do {
      if (Ku && (Iu = null), Fi = 0, Ku = !1, 25 <= u) throw Error(c(301));
      if (u += 1, Ht = vt = null, e.updateQueue != null) {
        var i = e.updateQueue;
        i.lastEffect = null, i.events = null, i.stores = null, i.memoCache != null && (i.memoCache.index = 0);
      }
      se.H = Xy, i = t(n, l);
    } while (Ku);
    return i;
  }
  function Hy() {
    var e = se.H, t = e.useState()[0];
    return t = typeof t.then == "function" ? Pi(t) : t, e = e.useState()[0], (vt !== null ? vt.memoizedState : null) !== e && (Ye.flags |= 1024), t;
  }
  function Ts() {
    var e = vo !== 0;
    return vo = 0, e;
  }
  function xs(e, t, n) {
    t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
  }
  function Cs(e) {
    if (fo) {
      for (e = e.memoizedState; e !== null; ) {
        var t = e.queue;
        t !== null && (t.pending = null), e = e.next;
      }
      fo = !1;
    }
    Gl = 0, Ht = vt = Ye = null, Ku = !1, Fi = vo = 0, Iu = null;
  }
  function gn() {
    var e = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return Ht === null ? Ye.memoizedState = Ht = e : Ht = Ht.next = e, Ht;
  }
  function Mt() {
    if (vt === null) {
      var e = Ye.alternate;
      e = e !== null ? e.memoizedState : null;
    } else e = vt.next;
    var t = Ht === null ? Ye.memoizedState : Ht.next;
    if (t !== null)
      Ht = t, vt = e;
    else {
      if (e === null)
        throw Ye.alternate === null ? Error(c(467)) : Error(c(310));
      vt = e, e = {
        memoizedState: vt.memoizedState,
        baseState: vt.baseState,
        baseQueue: vt.baseQueue,
        queue: vt.queue,
        next: null
      }, Ht === null ? Ye.memoizedState = Ht = e : Ht = Ht.next = e;
    }
    return Ht;
  }
  function go() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function Pi(e) {
    var t = Fi;
    return Fi += 1, Iu === null && (Iu = []), e = ev(Iu, e, t), t = Ye, (Ht === null ? t.memoizedState : Ht.next) === null && (t = t.alternate, se.H = t === null || t.memoizedState === null ? Kv : Iv), e;
  }
  function mo(e) {
    if (e !== null && typeof e == "object") {
      if (typeof e.then == "function") return Pi(e);
      if (e.$$typeof === U) return;
      if (e.$$typeof === oe) return Pt(e);
    }
    throw Error(c(438, String(e)));
  }
  function Rs(e) {
    var t = null, n = Ye.updateQueue;
    if (n !== null && (t = n.memoCache), t == null) {
      var l = Ye.alternate;
      l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (t = {
        data: l.data.map(function(u) {
          return u.slice();
        }),
        index: 0
      })));
    }
    if (t == null && (t = { data: [], index: 0 }), n === null && (n = go(), Ye.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0)
      for (n = t.data[t.index] = Array(e), l = 0; l < e; l++)
        n[l] = De;
    return t.index++, n;
  }
  function Xl(e, t) {
    return typeof t == "function" ? t(e) : t;
  }
  function ho(e) {
    var t = Mt();
    return As(t, vt, e);
  }
  function As(e, t, n) {
    var l = e.queue;
    if (l === null) throw Error(c(311));
    l.lastRenderedReducer = n;
    var u = e.baseQueue, i = l.pending;
    if (i !== null) {
      if (u !== null) {
        var s = u.next;
        u.next = i.next, i.next = s;
      }
      t.baseQueue = u = i, l.pending = null;
    }
    if (i = e.baseState, u === null) e.memoizedState = i;
    else {
      t = u.next;
      var v = s = null, T = null, w = t, X = !1;
      do {
        var J = w.lane & -536870913;
        if (J !== w.lane ? (Fe & J) === J : (Gl & J) === J) {
          var z = w.revertLane;
          if (z === 0)
            T !== null && (T = T.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: w.action,
              hasEagerState: w.hasEagerState,
              eagerState: w.eagerState,
              next: null
            }), J === lu && (X = !0);
          else if ((Gl & z) === z) {
            w = w.next, z === lu && (X = !0);
            continue;
          } else
            J = {
              lane: 0,
              revertLane: w.revertLane,
              gesture: null,
              action: w.action,
              hasEagerState: w.hasEagerState,
              eagerState: w.eagerState,
              next: null
            }, T === null ? (v = T = J, s = i) : T = T.next = J, Ye.lanes |= z, Ca |= z;
          J = w.action, ou && n(i, J), i = w.hasEagerState ? w.eagerState : n(i, J);
        } else
          z = {
            lane: J,
            revertLane: w.revertLane,
            gesture: w.gesture,
            action: w.action,
            hasEagerState: w.hasEagerState,
            eagerState: w.eagerState,
            next: null
          }, T === null ? (v = T = z, s = i) : T = T.next = z, Ye.lanes |= J, Ca |= J;
        w = w.next;
      } while (w !== null && w !== t);
      if (T === null ? s = i : T.next = v, !Dn(i, e.memoizedState) && (Bt = !0, X && (n = Gu, n !== null)))
        throw n;
      e.memoizedState = i, e.baseState = s, e.baseQueue = T, l.lastRenderedState = i;
    }
    return u === null && (l.lanes = 0), [e.memoizedState, l.dispatch];
  }
  function Os(e) {
    var t = Mt(), n = t.queue;
    if (n === null) throw Error(c(311));
    n.lastRenderedReducer = e;
    var l = n.dispatch, u = n.pending, i = t.memoizedState;
    if (u !== null) {
      n.pending = null;
      var s = u = u.next;
      do
        i = e(i, s.action), s = s.next;
      while (s !== u);
      Dn(i, t.memoizedState) || (Bt = !0), t.memoizedState = i, t.baseQueue === null && (t.baseState = i), n.lastRenderedState = i;
    }
    return [i, l];
  }
  function fv(e, t, n) {
    var l = Ye, u = Mt(), i = Ke;
    if (i) {
      if (n === void 0) throw Error(c(407));
      n = n();
    } else n = t();
    var s = !Dn(
      (vt || u).memoizedState,
      n
    );
    if (s && (u.memoizedState = n, Bt = !0), u = u.queue, Ms(gv.bind(null, l, u, e), [
      e
    ]), e = u.getSnapshot !== t || s || Ht !== null && (Ht.memoizedState.tag & 1) !== 0, Zu(
      e ? 9 : 8,
      { destroy: void 0 },
      vv.bind(null, l, u, n, t),
      null
    ), e) {
      if (l.flags |= 2048, gt === null) throw Error(c(349));
      i || (Gl & 127) !== 0 || dv(l, t, n);
    }
    return n;
  }
  function dv(e, t, n) {
    e.flags |= 16384, e = { getSnapshot: t, value: n }, t = Ye.updateQueue, t === null ? (t = go(), Ye.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
  }
  function vv(e, t, n, l) {
    t.value = n, t.getSnapshot = l, mv(t) && hv(e);
  }
  function gv(e, t, n) {
    return n(function() {
      mv(t) && hv(e);
    });
  }
  function mv(e) {
    var t = e.getSnapshot;
    e = e.value;
    try {
      var n = t();
      return !Dn(e, n);
    } catch {
      return !0;
    }
  }
  function hv(e) {
    var t = Pa(e, 2);
    t !== null && Cn(t, e, 2);
  }
  function Ns(e) {
    var t = gn();
    if (typeof e == "function") {
      var n = e;
      if (e = n(), ou) {
        _t(!0);
        try {
          n();
        } finally {
          _t(!1);
        }
      }
    }
    return t.memoizedState = t.baseState = e, t.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Xl,
      lastRenderedState: e
    }, t;
  }
  function pv(e, t, n, l) {
    return e.baseState = n, As(
      e,
      vt,
      typeof l == "function" ? l : Xl
    );
  }
  function By(e, t, n, l, u) {
    if (bo(e)) throw Error(c(485));
    if (e = t.action, e !== null) {
      var i = {
        payload: u,
        action: e,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(s) {
          i.listeners.push(s);
        }
      };
      se.T !== null ? n(!0) : i.isTransition = !1, l(i), n = t.pending, n === null ? (i.next = t.pending = i, yv(t, i)) : (i.next = n.next, t.pending = n.next = i);
    }
  }
  function yv(e, t) {
    var n = t.action, l = t.payload, u = e.state;
    if (t.isTransition) {
      var i = se.T, s = {};
      s.types = i !== null ? i.types : null, se.T = s;
      try {
        var v = n(u, l), T = se.S;
        T !== null && T(s, v), bv(e, t, v);
      } catch (w) {
        zs(e, t, w);
      } finally {
        i !== null && s.types !== null && (i.types = s.types), se.T = i;
      }
    } else
      try {
        i = n(u, l), bv(e, t, i);
      } catch (w) {
        zs(e, t, w);
      }
  }
  function bv(e, t, n) {
    n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(
      function(l) {
        Sv(e, t, l);
      },
      function(l) {
        return zs(e, t, l);
      }
    ) : Sv(e, t, n);
  }
  function Sv(e, t, n) {
    t.status = "fulfilled", t.value = n, Ev(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, yv(e, n)));
  }
  function zs(e, t, n) {
    var l = e.pending;
    if (e.pending = null, l !== null) {
      l = l.next;
      do
        t.status = "rejected", t.reason = n, Ev(t), t = t.next;
      while (t !== l);
    }
    e.action = null;
  }
  function Ev(e) {
    e = e.listeners;
    for (var t = 0; t < e.length; t++) (0, e[t])();
  }
  function Tv(e, t) {
    return t;
  }
  function xv(e, t) {
    if (Ke) {
      var n = gt.formState;
      if (n !== null) {
        e: {
          var l = Ye;
          if (Ke) {
            if (ht) {
              t: {
                for (var u = ht, i = Zn; u.nodeType !== 8; ) {
                  if (!i) {
                    u = null;
                    break t;
                  }
                  if (u = Jn(
                    u.nextSibling
                  ), u === null) {
                    u = null;
                    break t;
                  }
                }
                i = u.data, u = i === "F!" || i === "F" ? u : null;
              }
              if (u) {
                ht = Jn(
                  u.nextSibling
                ), l = u.data === "F!";
                break e;
              }
            }
            da(l);
          }
          l = !1;
        }
        l && (t = n[0]);
      }
    }
    return n = gn(), n.memoizedState = n.baseState = t, l = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Tv,
      lastRenderedState: t
    }, n.queue = l, n = Gv.bind(
      null,
      Ye,
      l
    ), l.dispatch = n, l = Ns(!1), i = Us.bind(
      null,
      Ye,
      !1,
      l.queue
    ), l = gn(), u = {
      state: t,
      dispatch: null,
      action: e,
      pending: null
    }, l.queue = u, n = By.bind(
      null,
      Ye,
      u,
      i,
      n
    ), u.dispatch = n, l.memoizedState = e, [t, n, !1];
  }
  function Cv(e) {
    var t = Mt();
    return Rv(t, vt, e);
  }
  function Rv(e, t, n) {
    if (t = As(
      e,
      t,
      Tv
    )[0], e = ho(Xl)[0], typeof t == "object" && t !== null && typeof t.then == "function")
      try {
        var l = Pi(t);
      } catch (s) {
        throw s === Xu ? uo : s;
      }
    else l = t;
    t = Mt();
    var u = t.queue, i = u.dispatch;
    return n !== t.memoizedState && (Ye.flags |= 2048, Zu(
      9,
      { destroy: void 0 },
      Ly.bind(null, u, n),
      null
    )), [l, i, e];
  }
  function Ly(e, t) {
    e.action = t;
  }
  function Av(e) {
    var t = Mt(), n = vt;
    if (n !== null)
      return Rv(t, n, e);
    Mt(), t = t.memoizedState, n = Mt();
    var l = n.queue.dispatch;
    return n.memoizedState = e, [t, l, !1];
  }
  function Zu(e, t, n, l) {
    return e = { tag: e, create: n, deps: l, inst: t, next: null }, t = Ye.updateQueue, t === null && (t = go(), Ye.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (l = n.next, n.next = e, e.next = l, t.lastEffect = e), e;
  }
  function Ov() {
    return Mt().memoizedState;
  }
  function po(e, t, n, l) {
    var u = gn();
    Ye.flags |= e, u.memoizedState = Zu(
      1 | t,
      { destroy: void 0 },
      n,
      l === void 0 ? null : l
    );
  }
  function yo(e, t, n, l) {
    var u = Mt();
    l = l === void 0 ? null : l;
    var i = u.memoizedState.inst;
    vt !== null && l !== null && Ss(l, vt.memoizedState.deps) ? u.memoizedState = Zu(t, i, n, l) : (Ye.flags |= e, u.memoizedState = Zu(
      1 | t,
      i,
      n,
      l
    ));
  }
  function Nv(e, t) {
    po(8390656, 8, e, t);
  }
  function Ms(e, t) {
    yo(2048, 8, e, t);
  }
  function Vy(e) {
    Ye.flags |= 4;
    var t = Ye.updateQueue;
    if (t === null)
      t = go(), Ye.updateQueue = t, t.events = [e];
    else {
      var n = t.events;
      n === null ? t.events = [e] : n.push(e);
    }
  }
  function zv(e) {
    var t = Mt().memoizedState;
    return Vy({ ref: t, nextImpl: e }), function() {
      if ((lt & 2) !== 0) throw Error(c(440));
      return t.impl.apply(void 0, arguments);
    };
  }
  function Mv(e, t) {
    return yo(4, 2, e, t);
  }
  function Dv(e, t) {
    return yo(4, 4, e, t);
  }
  function _v(e, t) {
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
  function wv(e, t, n) {
    n = n != null ? n.concat([e]) : null, yo(4, 4, _v.bind(null, t, e), n);
  }
  function Ds() {
  }
  function jv(e, t) {
    var n = Mt();
    t = t === void 0 ? null : t;
    var l = n.memoizedState;
    return t !== null && Ss(t, l[1]) ? l[0] : (n.memoizedState = [e, t], e);
  }
  function Uv(e, t) {
    var n = Mt();
    t = t === void 0 ? null : t;
    var l = n.memoizedState;
    if (t !== null && Ss(t, l[1]))
      return l[0];
    if (l = e(), ou) {
      _t(!0);
      try {
        e();
      } finally {
        _t(!1);
      }
    }
    return n.memoizedState = [l, t], l;
  }
  function _s(e, t, n) {
    return n === void 0 || (Gl & 1073741824) !== 0 && (Fe & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = n, e = Kg(), Ye.lanes |= e, Ca |= e, n);
  }
  function Hv(e, t, n, l) {
    return Dn(n, t) ? n : ya.current !== null ? (e = _s(e, n, l), Dn(e, t) || (Bt = !0), e) : (Gl & 106) === 0 || (Gl & 1073741824) !== 0 && (Fe & 261930) === 0 ? (Bt = !0, e.memoizedState = n) : (e = Kg(), Ye.lanes |= e, Ca |= e, t);
  }
  function Bv(e, t, n, l, u) {
    var i = ve.p;
    ve.p = i !== 0 && 8 > i ? i : 8;
    var s = se.T, v = {};
    v.types = s !== null ? s.types : null, se.T = v, Us(e, !1, t, n);
    try {
      var T = u(), w = se.S;
      if (w !== null && w(v, T), T !== null && typeof T == "object" && typeof T.then == "function") {
        var X = jy(
          T,
          l
        );
        Wi(
          e,
          t,
          X,
          Hn(e)
        );
      } else
        Wi(
          e,
          t,
          l,
          Hn(e)
        );
    } catch (J) {
      Wi(
        e,
        t,
        { then: function() {
        }, status: "rejected", reason: J },
        Hn()
      );
    } finally {
      ve.p = i, s !== null && v.types !== null && (s.types = v.types), se.T = s;
    }
  }
  function qy() {
  }
  function ws(e, t, n, l) {
    if (e.tag !== 5) throw Error(c(476));
    var u = Lv(e).queue;
    Bv(
      e,
      u,
      t,
      tt,
      n === null ? qy : function() {
        return Vv(e), n(l);
      }
    );
  }
  function Lv(e) {
    var t = e.memoizedState;
    if (t !== null) return t;
    t = {
      memoizedState: tt,
      baseState: tt,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Xl,
        lastRenderedState: tt
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
        lastRenderedReducer: Xl,
        lastRenderedState: n
      },
      next: null
    }, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
  }
  function Vv(e) {
    var t = Lv(e);
    t.next === null && (t = e.alternate.memoizedState), Wi(
      e,
      t.next.queue,
      {},
      Hn()
    );
  }
  function js() {
    return Pt(di);
  }
  function qv() {
    return Mt().memoizedState;
  }
  function Yv() {
    return Mt().memoizedState;
  }
  function Yy(e) {
    for (var t = e.return; t !== null; ) {
      switch (t.tag) {
        case 24:
        case 3:
          var n = Hn();
          e = ha(n);
          var l = pa(t, e, n);
          l !== null && (Cn(l, t, n), Ii(l, t, n)), t = { cache: os() }, e.payload = t;
          return;
      }
      t = t.return;
    }
  }
  function Gy(e, t, n) {
    var l = Hn();
    n = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, bo(e) ? Xv(t, n) : (n = $c(e, t, n, l), n !== null && (Cn(n, e, l), Qv(n, t, l)));
  }
  function Gv(e, t, n) {
    var l = Hn();
    Wi(e, t, n, l);
  }
  function Wi(e, t, n, l) {
    var u = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (bo(e)) Xv(t, u);
    else {
      var i = e.alternate;
      if (e.lanes === 0 && (i === null || i.lanes === 0) && (i = t.lastRenderedReducer, i !== null))
        try {
          var s = t.lastRenderedState, v = i(s, n);
          if (u.hasEagerState = !0, u.eagerState = v, Dn(v, s))
            return Jr(e, t, u, 0), gt === null && kr(), !1;
        } catch {
        }
      if (n = $c(e, t, u, l), n !== null)
        return Cn(n, e, l), Qv(n, t, l), !0;
    }
    return !1;
  }
  function Us(e, t, n, l) {
    if (l = {
      lane: 2,
      revertLane: Af(),
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, bo(e)) {
      if (t) throw Error(c(479));
    } else
      t = $c(
        e,
        n,
        l,
        2
      ), t !== null && Cn(t, e, 2);
  }
  function bo(e) {
    var t = e.alternate;
    return e === Ye || t !== null && t === Ye;
  }
  function Xv(e, t) {
    Ku = fo = !0;
    var n = e.pending;
    n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
  }
  function Qv(e, t, n) {
    if ((n & 4194048) !== 0) {
      var l = t.lanes;
      l &= e.pendingLanes, n |= l, t.lanes = n, Ru(e, n);
    }
  }
  var So = {
    readContext: Pt,
    use: mo,
    useCallback: At,
    useContext: At,
    useEffect: At,
    useImperativeHandle: At,
    useLayoutEffect: At,
    useInsertionEffect: At,
    useMemo: At,
    useReducer: At,
    useRef: At,
    useState: At,
    useDebugValue: At,
    useDeferredValue: At,
    useTransition: At,
    useSyncExternalStore: At,
    useId: At,
    useHostTransitionStatus: At,
    useFormState: At,
    useActionState: At,
    useOptimistic: At,
    useMemoCache: At,
    useCacheRefresh: At,
    useEffectEvent: At
  }, Kv = {
    readContext: Pt,
    use: mo,
    useCallback: function(e, t) {
      return gn().memoizedState = [
        e,
        t === void 0 ? null : t
      ], e;
    },
    useContext: Pt,
    useEffect: Nv,
    useImperativeHandle: function(e, t, n) {
      n = n != null ? n.concat([e]) : null, po(
        4194308,
        4,
        _v.bind(null, t, e),
        n
      );
    },
    useLayoutEffect: function(e, t) {
      return po(4194308, 4, e, t);
    },
    useInsertionEffect: function(e, t) {
      po(4, 2, e, t);
    },
    useMemo: function(e, t) {
      var n = gn();
      t = t === void 0 ? null : t;
      var l = e();
      if (ou) {
        _t(!0);
        try {
          e();
        } finally {
          _t(!1);
        }
      }
      return n.memoizedState = [l, t], l;
    },
    useReducer: function(e, t, n) {
      var l = gn();
      if (n !== void 0) {
        var u = n(t);
        if (ou) {
          _t(!0);
          try {
            n(t);
          } finally {
            _t(!1);
          }
        }
      } else u = t;
      return l.memoizedState = l.baseState = u, e = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: e,
        lastRenderedState: u
      }, l.queue = e, e = e.dispatch = Gy.bind(
        null,
        Ye,
        e
      ), [l.memoizedState, e];
    },
    useRef: function(e) {
      var t = gn();
      return e = { current: e }, t.memoizedState = e;
    },
    useState: function(e) {
      e = Ns(e);
      var t = e.queue, n = Gv.bind(null, Ye, t);
      return t.dispatch = n, [e.memoizedState, n];
    },
    useDebugValue: Ds,
    useDeferredValue: function(e, t) {
      var n = gn();
      return _s(n, e, t);
    },
    useTransition: function() {
      var e = Ns(!1);
      return e = Bv.bind(
        null,
        Ye,
        e.queue,
        !0,
        !1
      ), gn().memoizedState = e, [!1, e];
    },
    useSyncExternalStore: function(e, t, n) {
      var l = Ye, u = gn();
      if (Ke) {
        if (n === void 0)
          throw Error(c(407));
        n = n();
      } else {
        if (n = t(), gt === null)
          throw Error(c(349));
        (Fe & 127) !== 0 || dv(l, t, n);
      }
      u.memoizedState = n;
      var i = { value: n, getSnapshot: t };
      return u.queue = i, Nv(gv.bind(null, l, i, e), [
        e
      ]), l.flags |= 2048, Zu(
        9,
        { destroy: void 0 },
        vv.bind(
          null,
          l,
          i,
          n,
          t
        ),
        null
      ), n;
    },
    useId: function() {
      var e = gn(), t = gt.identifierPrefix;
      if (Ke) {
        var n = pl, l = hl;
        n = (l & ~(1 << 32 - Gt(l) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = vo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
      } else
        n = Uy++, t = "_" + t + "r_" + n.toString(32) + "_";
      return e.memoizedState = t;
    },
    useHostTransitionStatus: js,
    useFormState: xv,
    useActionState: xv,
    useOptimistic: function(e) {
      var t = gn();
      t.memoizedState = t.baseState = e;
      var n = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return t.queue = n, t = Us.bind(
        null,
        Ye,
        !0,
        n
      ), n.dispatch = t, [e, t];
    },
    useMemoCache: Rs,
    useCacheRefresh: function() {
      return gn().memoizedState = Yy.bind(
        null,
        Ye
      );
    },
    useEffectEvent: function(e) {
      var t = gn(), n = { impl: e };
      return t.memoizedState = n, function() {
        if ((lt & 2) !== 0)
          throw Error(c(440));
        return n.impl.apply(void 0, arguments);
      };
    }
  }, Iv = {
    readContext: Pt,
    use: mo,
    useCallback: jv,
    useContext: Pt,
    useEffect: Ms,
    useImperativeHandle: wv,
    useInsertionEffect: Mv,
    useLayoutEffect: Dv,
    useMemo: Uv,
    useReducer: ho,
    useRef: Ov,
    useState: function() {
      return ho(Xl);
    },
    useDebugValue: Ds,
    useDeferredValue: function(e, t) {
      var n = Mt();
      return Hv(
        n,
        vt.memoizedState,
        e,
        t
      );
    },
    useTransition: function() {
      var e = ho(Xl)[0], t = Mt().memoizedState;
      return [
        typeof e == "boolean" ? e : Pi(e),
        t
      ];
    },
    useSyncExternalStore: fv,
    useId: qv,
    useHostTransitionStatus: js,
    useFormState: Cv,
    useActionState: Cv,
    useOptimistic: function(e, t) {
      var n = Mt();
      return pv(n, vt, e, t);
    },
    useMemoCache: Rs,
    useCacheRefresh: Yv,
    useEffectEvent: zv
  }, Xy = {
    readContext: Pt,
    use: mo,
    useCallback: jv,
    useContext: Pt,
    useEffect: Ms,
    useImperativeHandle: wv,
    useInsertionEffect: Mv,
    useLayoutEffect: Dv,
    useMemo: Uv,
    useReducer: Os,
    useRef: Ov,
    useState: function() {
      return Os(Xl);
    },
    useDebugValue: Ds,
    useDeferredValue: function(e, t) {
      var n = Mt();
      return vt === null ? _s(n, e, t) : Hv(
        n,
        vt.memoizedState,
        e,
        t
      );
    },
    useTransition: function() {
      var e = Os(Xl)[0], t = Mt().memoizedState;
      return [
        typeof e == "boolean" ? e : Pi(e),
        t
      ];
    },
    useSyncExternalStore: fv,
    useId: qv,
    useHostTransitionStatus: js,
    useFormState: Av,
    useActionState: Av,
    useOptimistic: function(e, t) {
      var n = Mt();
      return vt !== null ? pv(n, vt, e, t) : (n.baseState = e, [e, n.queue.dispatch]);
    },
    useMemoCache: Rs,
    useCacheRefresh: Yv,
    useEffectEvent: zv
  };
  function Hs(e, t, n, l) {
    t = e.memoizedState, n = n(l, t), n = n == null ? t : L({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
  }
  var Bs = {
    enqueueSetState: function(e, t, n) {
      e = e._reactInternals;
      var l = Hn(), u = ha(l);
      u.payload = t, n != null && (u.callback = n), t = pa(e, u, l), t !== null && (Cn(t, e, l), Ii(t, e, l));
    },
    enqueueReplaceState: function(e, t, n) {
      e = e._reactInternals;
      var l = Hn(), u = ha(l);
      u.tag = 1, u.payload = t, n != null && (u.callback = n), t = pa(e, u, l), t !== null && (Cn(t, e, l), Ii(t, e, l));
    },
    enqueueForceUpdate: function(e, t) {
      e = e._reactInternals;
      var n = Hn(), l = ha(n);
      l.tag = 2, t != null && (l.callback = t), t = pa(e, l, n), t !== null && (Cn(t, e, n), Ii(t, e, n));
    }
  };
  function Zv(e, t, n, l, u, i, s) {
    return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(l, i, s) : t.prototype && t.prototype.isPureReactComponent ? !Li(n, l) || !Li(u, i) : !0;
  }
  function kv(e, t, n, l) {
    e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, l), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, l), t.state !== e && Bs.enqueueReplaceState(t, t.state, null);
  }
  function cu(e, t) {
    var n = t;
    if ("ref" in t) {
      n = {};
      for (var l in t)
        l !== "ref" && (n[l] = t[l]);
    }
    if (e = e.defaultProps) {
      n === t && (n = L({}, n));
      for (var u in e)
        n[u] === void 0 && (n[u] = e[u]);
    }
    return n;
  }
  function Jv(e) {
    Zr(e);
  }
  function Fv(e) {
    console.error(e);
  }
  function Pv(e) {
    Zr(e);
  }
  function Eo(e, t) {
    try {
      var n = e.onUncaughtError;
      n(t.value, { componentStack: t.stack });
    } catch (l) {
      setTimeout(function() {
        throw l;
      });
    }
  }
  function Wv(e, t, n) {
    try {
      var l = e.onCaughtError;
      l(n.value, {
        componentStack: n.stack,
        errorBoundary: t.tag === 1 ? t.stateNode : null
      });
    } catch (u) {
      setTimeout(function() {
        throw u;
      });
    }
  }
  function Ls(e, t, n) {
    return n = ha(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
      Eo(e, t);
    }, n;
  }
  function $v(e) {
    return e = ha(e), e.tag = 3, e;
  }
  function eg(e, t, n, l) {
    var u = n.type.getDerivedStateFromError;
    if (typeof u == "function") {
      var i = l.value;
      e.payload = function() {
        return u(i);
      }, e.callback = function() {
        Wv(t, n, l);
      };
    }
    var s = n.stateNode;
    s !== null && typeof s.componentDidCatch == "function" && (e.callback = function() {
      Wv(t, n, l), typeof u != "function" && (Ra === null ? Ra = /* @__PURE__ */ new Set([this]) : Ra.add(this));
      var v = l.stack;
      this.componentDidCatch(l.value, {
        componentStack: v !== null ? v : ""
      });
    });
  }
  function Qy(e, t, n, l, u) {
    if (n.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
      if (t = n.alternate, t !== null && tu(
        t,
        n,
        u,
        !0
      ), n = Wt.current, n !== null) {
        switch (n.tag) {
          case 31:
          case 13:
          case 19:
            return on === null ? Go() : n.alternate === null && Ot === 0 && (Ot = 3), n.flags &= -257, n.flags |= 65536, n.lanes = u, l === io ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([l]) : t.add(l), xf(e, l, u)), !1;
          case 22:
            return n.flags |= 65536, l === io ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([l])
            }, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([l]) : n.add(l)), xf(e, l, u)), !1;
        }
        throw Error(c(435, n.tag));
      }
      return xf(e, l, u), Go(), !1;
    }
    if (Ke)
      return t = Wt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = u, l !== as && (e = Error(c(422), { cause: l }), Yi(Qn(e, n)))) : (l !== as && (t = Error(c(423), {
        cause: l
      }), Yi(
        Qn(t, n)
      )), e = e.current.alternate, e.flags |= 65536, u &= -u, e.lanes |= u, l = Qn(l, n), u = Ls(
        e.stateNode,
        l,
        u
      ), gs(e, u), Ot !== 4 && (Ot = 2)), !1;
    var i = Error(c(520), { cause: l });
    if (i = Qn(i, n), ir === null ? ir = [i] : ir.push(i), Ot !== 4 && (Ot = 2), t === null) return !0;
    l = Qn(l, n), n = t;
    do {
      switch (n.tag) {
        case 3:
          return n.flags |= 65536, e = u & -u, n.lanes |= e, e = Ls(n.stateNode, l, e), gs(n, e), !1;
        case 1:
          if (t = n.type, i = n.stateNode, (n.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || i !== null && typeof i.componentDidCatch == "function" && (Ra === null || !Ra.has(i))))
            return n.flags |= 65536, u &= -u, n.lanes |= u, u = $v(u), eg(
              u,
              e,
              n,
              l
            ), gs(n, u), !1;
          break;
        case 22:
          if (n.memoizedState !== null)
            return n.flags |= 65536, !1;
      }
      n = n.return;
    } while (n !== null);
    return !1;
  }
  var Vs = Error(c(461)), Bt = !1;
  function qt(e, t, n, l) {
    t.child = e === null ? av(t, null, n, l) : ru(
      t,
      e.child,
      n,
      l
    );
  }
  function tg(e, t, n, l, u) {
    n = n.render;
    var i = t.ref;
    if ("ref" in l) {
      var s = {};
      for (var v in l)
        v !== "ref" && (s[v] = l[v]);
    } else s = l;
    return nu(t), l = Es(
      e,
      t,
      n,
      s,
      i,
      u
    ), v = Ts(), e !== null && !Bt ? (xs(e, t, u), Ql(e, t, u)) : (Ke && v && $r(t), t.flags |= 1, qt(e, t, l, u), t.child);
  }
  function ng(e, t, n, l, u) {
    if (e === null) {
      var i = n.type;
      return typeof i == "function" && !es(i) && i.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = i, lg(
        e,
        t,
        i,
        l,
        u
      )) : (e = Pr(
        n.type,
        null,
        l,
        t,
        t.mode,
        u
      ), e.ref = t.ref, e.return = t, t.child = e);
    }
    if (i = e.child, !Zs(e, u)) {
      var s = i.memoizedProps;
      if (n = n.compare, n = n !== null ? n : Li, n(s, l) && e.ref === t.ref)
        return Ql(e, t, u);
    }
    return t.flags |= 1, e = Ll(i, l), e.ref = t.ref, e.return = t, t.child = e;
  }
  function lg(e, t, n, l, u) {
    if (e !== null) {
      var i = e.memoizedProps;
      if (Li(i, l) && e.ref === t.ref)
        if (Bt = !1, t.pendingProps = l = i, Zs(e, u))
          (e.flags & 131072) !== 0 && (Bt = !0);
        else
          return t.lanes = e.lanes, Ql(e, t, u);
    }
    return qs(
      e,
      t,
      n,
      l,
      u
    );
  }
  function ag(e, t, n, l) {
    var u = l.children, i = e !== null ? e.memoizedState : null;
    if (e === null && t.stateNode === null && (t.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), l.mode === "hidden") {
      if ((t.flags & 128) !== 0) {
        if (i = i !== null ? i.baseLanes | n : n, e !== null) {
          for (l = t.child = e.child, u = 0; l !== null; )
            u = u | l.lanes | l.childLanes, l = l.sibling;
          l = u & ~i;
        } else l = 0, t.child = null;
        return ug(
          e,
          t,
          i,
          n,
          l
        );
      }
      if ((n & 536870912) !== 0)
        t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && ao(
          t,
          i !== null ? i.cachePool : null
        ), i !== null ? rv(t, i) : hs(), ov(t);
      else
        return l = t.lanes = 536870912, ug(
          e,
          t,
          i !== null ? i.baseLanes | n : n,
          n,
          l
        );
    } else
      i !== null ? (ao(t, i.cachePool), rv(t, i), Sa(), t.memoizedState = null) : (e !== null && ao(t, null), hs(), Sa());
    return qt(e, t, u, n), t.child;
  }
  function $i(e, t) {
    return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), t.sibling;
  }
  function ug(e, t, n, l, u) {
    var i = ss();
    return i = i === null ? null : { parent: Ut._currentValue, pool: i }, t.memoizedState = {
      baseLanes: n,
      cachePool: i
    }, e !== null && ao(t, null), hs(), ov(t), e !== null && tu(e, t, l, !0), t.childLanes = u, null;
  }
  function To(e, t) {
    return t = xo(
      { mode: t.mode, children: t.children },
      e.mode
    ), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function ig(e, t, n) {
    return ru(t, e.child, null, n), e = To(t, t.pendingProps), e.flags |= 2, _n(t), t.memoizedState = null, e;
  }
  function Ky(e, t, n) {
    var l = t.pendingProps, u = (t.flags & 128) !== 0;
    if (t.flags &= -129, e === null) {
      if (Ke) {
        if (l.mode === "hidden")
          return e = To(t, l), t.lanes = 536870912, e.memoizedState = { baseLanes: 0, cachePool: null }, $i(null, e);
        if (ys(t), (e = ht) ? (e = _m(
          e,
          Zn
        ), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
          dehydrated: e,
          treeContext: sa !== null ? { id: hl, overflow: pl } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, n = X0(e), n.return = t, t.child = n, Qt = t, ht = null)) : e = null, e === null) throw da(t);
        return t.lanes = 536870912, null;
      }
      return To(t, l);
    }
    var i = e.memoizedState;
    if (i !== null) {
      var s = i.dehydrated;
      if (ys(t), u)
        if (t.flags & 256)
          t.flags &= -257, t = ig(
            e,
            t,
            n
          );
        else if (t.memoizedState !== null)
          t.child = e.child, t.flags |= 128, t = null;
        else throw Error(c(558));
      else if (Bt || tu(e, t, n, !1), u = (n & e.childLanes) !== 0, Bt || u) {
        if (ya.current === null) {
          if (l = gt, l !== null && (s = qa(l, n), s !== 0 && s !== i.retryLane))
            throw i.retryLane = s, Pa(e, s), Cn(l, e, s), Vs;
          Go();
        }
        t = ig(
          e,
          t,
          n
        );
      } else
        e = i.treeContext, ht = Jn(s.nextSibling), Qt = t, Ke = !0, fa = null, Zn = !1, e !== null && I0(t, e), t = To(t, l), t.flags |= 134221824;
      return t;
    }
    return e = Ll(e.child, {
      mode: l.mode,
      children: l.children
    }), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function ku(e, t) {
    var n = t.ref;
    if (n === null)
      e !== null && e.ref !== null && (t.flags |= 4194816);
    else {
      if (typeof n != "function" && typeof n != "object")
        throw Error(c(284));
      (e === null || e.ref !== n) && (t.flags |= 4194816);
    }
  }
  function qs(e, t, n, l, u) {
    return nu(t), n = Es(
      e,
      t,
      n,
      l,
      void 0,
      u
    ), l = Ts(), e !== null && !Bt ? (xs(e, t, u), Ql(e, t, u)) : (Ke && l && $r(t), t.flags |= 1, qt(e, t, n, u), t.child);
  }
  function rg(e, t, n, l, u, i) {
    return nu(t), t.updateQueue = null, n = sv(
      t,
      l,
      n,
      u
    ), cv(e), l = Ts(), e !== null && !Bt ? (xs(e, t, i), Ql(e, t, i)) : (Ke && l && $r(t), t.flags |= 1, qt(e, t, n, i), t.child);
  }
  function og(e, t, n, l, u) {
    if (nu(t), t.stateNode === null) {
      var i = Lu, s = n.contextType;
      typeof s == "object" && s !== null && (i = Pt(s)), i = new n(l, i), t.memoizedState = i.state !== null && i.state !== void 0 ? i.state : null, i.updater = Bs, t.stateNode = i, i._reactInternals = t, i = t.stateNode, i.props = l, i.state = t.memoizedState, i.refs = {}, ds(t), s = n.contextType, i.context = typeof s == "object" && s !== null ? Pt(s) : Lu, i.state = t.memoizedState, s = n.getDerivedStateFromProps, typeof s == "function" && (Hs(
        t,
        n,
        s,
        l
      ), i.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof i.getSnapshotBeforeUpdate == "function" || typeof i.UNSAFE_componentWillMount != "function" && typeof i.componentWillMount != "function" || (s = i.state, typeof i.componentWillMount == "function" && i.componentWillMount(), typeof i.UNSAFE_componentWillMount == "function" && i.UNSAFE_componentWillMount(), s !== i.state && Bs.enqueueReplaceState(i, i.state, null), ki(t, l, i, u), Zi(), i.state = t.memoizedState), typeof i.componentDidMount == "function" && (t.flags |= 4194308), l = !0;
    } else if (e === null) {
      i = t.stateNode;
      var v = t.memoizedProps, T = cu(n, v);
      i.props = T;
      var w = i.context, X = n.contextType;
      s = Lu, typeof X == "object" && X !== null && (s = Pt(X));
      var J = n.getDerivedStateFromProps;
      X = typeof J == "function" || typeof i.getSnapshotBeforeUpdate == "function", v = t.pendingProps !== v, X || typeof i.UNSAFE_componentWillReceiveProps != "function" && typeof i.componentWillReceiveProps != "function" || (v || w !== s) && kv(
        t,
        i,
        l,
        s
      ), ma = !1;
      var z = t.memoizedState;
      i.state = z, ki(t, l, i, u), Zi(), w = t.memoizedState, v || z !== w || ma ? (typeof J == "function" && (Hs(
        t,
        n,
        J,
        l
      ), w = t.memoizedState), (T = ma || Zv(
        t,
        n,
        T,
        l,
        z,
        w,
        s
      )) ? (X || typeof i.UNSAFE_componentWillMount != "function" && typeof i.componentWillMount != "function" || (typeof i.componentWillMount == "function" && i.componentWillMount(), typeof i.UNSAFE_componentWillMount == "function" && i.UNSAFE_componentWillMount()), typeof i.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof i.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = l, t.memoizedState = w), i.props = l, i.state = w, i.context = s, l = T) : (typeof i.componentDidMount == "function" && (t.flags |= 4194308), l = !1);
    } else {
      i = t.stateNode, vs(e, t), s = t.memoizedProps, X = cu(n, s), i.props = X, J = t.pendingProps, z = i.context, w = n.contextType, T = Lu, typeof w == "object" && w !== null && (T = Pt(w)), v = n.getDerivedStateFromProps, (w = typeof v == "function" || typeof i.getSnapshotBeforeUpdate == "function") || typeof i.UNSAFE_componentWillReceiveProps != "function" && typeof i.componentWillReceiveProps != "function" || (s !== J || z !== T) && kv(
        t,
        i,
        l,
        T
      ), ma = !1, z = t.memoizedState, i.state = z, ki(t, l, i, u), Zi();
      var B = t.memoizedState;
      s !== J || z !== B || ma || e !== null && e.dependencies !== null && no(e.dependencies) ? (typeof v == "function" && (Hs(
        t,
        n,
        v,
        l
      ), B = t.memoizedState), (X = ma || Zv(
        t,
        n,
        X,
        l,
        z,
        B,
        T
      ) || e !== null && e.dependencies !== null && no(e.dependencies)) ? (w || typeof i.UNSAFE_componentWillUpdate != "function" && typeof i.componentWillUpdate != "function" || (typeof i.componentWillUpdate == "function" && i.componentWillUpdate(l, B, T), typeof i.UNSAFE_componentWillUpdate == "function" && i.UNSAFE_componentWillUpdate(
        l,
        B,
        T
      )), typeof i.componentDidUpdate == "function" && (t.flags |= 4), typeof i.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof i.componentDidUpdate != "function" || s === e.memoizedProps && z === e.memoizedState || (t.flags |= 4), typeof i.getSnapshotBeforeUpdate != "function" || s === e.memoizedProps && z === e.memoizedState || (t.flags |= 1024), t.memoizedProps = l, t.memoizedState = B), i.props = l, i.state = B, i.context = T, l = X) : (typeof i.componentDidUpdate != "function" || s === e.memoizedProps && z === e.memoizedState || (t.flags |= 4), typeof i.getSnapshotBeforeUpdate != "function" || s === e.memoizedProps && z === e.memoizedState || (t.flags |= 1024), l = !1);
    }
    return i = l, ku(e, t), l = (t.flags & 128) !== 0, i || l ? (i = t.stateNode, n = l && typeof n.getDerivedStateFromError != "function" ? null : i.render(), t.flags |= 1, e !== null && l ? (t.child = ru(
      t,
      e.child,
      null,
      u
    ), t.child = ru(
      t,
      null,
      n,
      u
    )) : qt(e, t, n, u), t.memoizedState = i.state, e = t.child) : e = Ql(
      e,
      t,
      u
    ), e;
  }
  function cg(e, t, n, l) {
    return $a(), t.flags |= 256, qt(e, t, n, l), t.child;
  }
  var Ys = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function Gs(e) {
    return { baseLanes: e, cachePool: W0() };
  }
  function Xs(e, t, n) {
    return e = e !== null ? e.childLanes & ~n : 0, t && (e |= Un), e;
  }
  function sg(e, t, n) {
    var l = t.pendingProps, u = !1, i = (t.flags & 128) !== 0, s;
    if ((s = i) || (s = e !== null && e.memoizedState === null ? !1 : ($t.current & 2) !== 0), s && (u = !0, t.flags &= -129), s = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
      if (Ke) {
        if (u ? ba(t) : Sa(), (e = ht) ? (e = _m(
          e,
          Zn
        ), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
          dehydrated: e,
          treeContext: sa !== null ? { id: hl, overflow: pl } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, n = X0(e), n.return = t, t.child = n, Qt = t, ht = null)) : e = null, e === null) throw da(t);
        return Xf(e) ? t.lanes = 32 : t.lanes = 536870912, null;
      }
      return i = l.children, l = l.fallback, u ? (Sa(), u = t.mode, i = xo(
        { mode: "hidden", children: i },
        u
      ), l = Wa(
        l,
        u,
        n,
        null
      ), i.return = t, l.return = t, i.sibling = l, t.child = i, l = t.child, l.memoizedState = Gs(n), l.childLanes = Xs(
        e,
        s,
        n
      ), t.memoizedState = Ys, $i(null, l)) : (ba(t), Qs(t, i));
    }
    var v = e.memoizedState;
    if (v !== null) {
      var T = v.dehydrated;
      if (T !== null)
        return Iy(
          e,
          t,
          i,
          s,
          l,
          T,
          v,
          n
        );
    }
    return u ? (Sa(), u = l.fallback, i = t.mode, v = e.child, T = v.sibling, l = Ll(v, {
      mode: "hidden",
      children: l.children
    }), l.subtreeFlags = v.subtreeFlags & 1206910976, T !== null ? u = Ll(T, u) : (u = Wa(
      u,
      i,
      n,
      null
    ), u.flags |= 2), u.return = t, l.return = t, l.sibling = u, t.child = l, $i(null, l), l = t.child, u = e.child.memoizedState, u === null ? u = Gs(n) : (i = u.cachePool, i !== null ? (v = Ut._currentValue, i = i.parent !== v ? { parent: v, pool: v } : i) : i = W0(), u = {
      baseLanes: u.baseLanes | n,
      cachePool: i
    }), l.memoizedState = u, l.childLanes = Xs(
      e,
      s,
      n
    ), t.memoizedState = Ys, $i(e.child, l)) : (ba(t), n = e.child, e = n.sibling, n = Ll(n, {
      mode: "visible",
      children: l.children
    }), n.return = t, n.sibling = null, e !== null && (s = t.deletions, s === null ? (t.deletions = [e], t.flags |= 16) : s.push(e)), t.child = n, t.memoizedState = null, n);
  }
  function Qs(e, t) {
    return t = xo(
      { mode: "visible", children: t },
      e.mode
    ), t.return = e, e.child = t;
  }
  function xo(e, t) {
    return e = Sn(22, e, null, t), e.lanes = 0, e;
  }
  function Co(e, t, n) {
    return ru(t, e.child, null, n), e = Qs(
      t,
      t.pendingProps.children
    ), e.flags |= 2, t.memoizedState = null, e;
  }
  function Iy(e, t, n, l, u, i, s, v) {
    if (n)
      return t.flags & 256 ? (ba(t), t.flags &= -257, Co(
        e,
        t,
        v
      )) : t.memoizedState !== null ? (Sa(), t.child = e.child, t.flags |= 128, null) : (Sa(), i = u.fallback, s = t.mode, u = xo(
        { mode: "visible", children: u.children },
        s
      ), i = Wa(
        i,
        s,
        v,
        null
      ), i.flags |= 2, u.return = t, i.return = t, u.sibling = i, t.child = u, ru(t, e.child, null, v), u = t.child, u.memoizedState = Gs(v), u.childLanes = Xs(
        e,
        l,
        v
      ), t.memoizedState = Ys, $i(null, u));
    if (ba(t), Xf(i)) {
      if (l = i.nextSibling && i.nextSibling.dataset, l) var T = l.dgst;
      return l = T, l !== "" && (u = Error(c(419)), u.stack = "", u.digest = l, Yi({ value: u, source: null, stack: null })), Co(
        e,
        t,
        v
      );
    }
    if (Bt || tu(e, t, v, !1), l = (v & e.childLanes) !== 0, Bt || l) {
      if (ya.current !== null)
        return Co(
          e,
          t,
          v
        );
      if (l = gt, l !== null && (u = qa(
        l,
        v
      ), u !== 0 && u !== s.retryLane))
        throw s.retryLane = u, Pa(e, u), Cn(l, e, u), Vs;
      return Gf(i) || Go(), Co(
        e,
        t,
        v
      );
    }
    return Gf(i) ? (t.flags |= 192, t.child = e.child, null) : (e = s.treeContext, ht = Jn(i.nextSibling), Qt = t, Ke = !0, fa = null, Zn = !1, e !== null && I0(t, e), t = Qs(
      t,
      u.children
    ), t.flags |= 134221824, t);
  }
  function fg(e, t, n) {
    e.lanes |= t;
    var l = e.alternate;
    l !== null && (l.lanes |= t), to(e.return, t, n);
  }
  function dg(e) {
    for (var t = null; e !== null; ) {
      var n = e.alternate;
      n !== null && so(n) === null && (t = e), e = e.sibling;
    }
    return t;
  }
  function Ro(e, t, n, l, u, i) {
    var s = e.memoizedState;
    s === null ? e.memoizedState = {
      isBackwards: t,
      rendering: null,
      renderingStartTime: 0,
      last: l,
      tail: n,
      tailMode: u,
      treeForkCount: i
    } : (s.isBackwards = t, s.rendering = null, s.renderingStartTime = 0, s.last = l, s.tail = n, s.tailMode = u, s.treeForkCount = i);
  }
  function Ks(e) {
    var t = e.child;
    for (e.child = null; t !== null; ) {
      var n = t.sibling;
      t.sibling = e.child, e.child = t, t = n;
    }
  }
  function Is(e, t, n) {
    var l = t.pendingProps, u = l.revealOrder, i = l.tail;
    l = l.children;
    var s = $t.current;
    if (t.flags & 128)
      return Ji(t, s), null;
    var v = (s & 2) !== 0;
    if (v ? (s = s & 1 | 2, t.flags |= 128) : s &= 1, Ji(t, s), u === "backwards" && e !== null ? (Ks(e), qt(e, t, l, n), Ks(e)) : qt(e, t, l, n), l = Ke ? qi : 0, !v && e !== null && (e.flags & 128) !== 0)
      e: for (e = t.child; e !== null; ) {
        if (e.tag === 13)
          e.memoizedState !== null && fg(e, n, t);
        else if (e.tag === 19)
          fg(e, n, t);
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
    switch (u) {
      case "backwards":
        n = dg(t.child), n === null ? (u = t.child, t.child = null) : (u = n.sibling, n.sibling = null, Ks(t)), Ro(
          t,
          !0,
          u,
          null,
          i,
          l
        );
        break;
      case "unstable_legacy-backwards":
        for (n = null, u = t.child, t.child = null; u !== null; ) {
          if (e = u.alternate, e !== null && so(e) === null) {
            t.child = u;
            break;
          }
          e = u.sibling, u.sibling = n, n = u, u = e;
        }
        Ro(
          t,
          !0,
          n,
          null,
          i,
          l
        );
        break;
      case "together":
        Ro(
          t,
          !1,
          null,
          null,
          void 0,
          l
        );
        break;
      case "independent":
        t.memoizedState = null;
        break;
      default:
        n = dg(t.child), n === null ? (u = t.child, t.child = null) : (u = n.sibling, n.sibling = null), Ro(
          t,
          !1,
          u,
          n,
          i,
          l
        );
    }
    return t.child;
  }
  function vg(e, t, n) {
    var l = t.pendingProps;
    return va(t, t.type, l.value), qt(e, t, l.children, n), t.child;
  }
  function Ql(e, t, n) {
    if (e !== null && (t.dependencies = e.dependencies), Ca |= t.lanes, (n & t.childLanes) === 0)
      if (e !== null) {
        if (tu(
          e,
          t,
          n,
          !1
        ), (n & t.childLanes) === 0)
          return null;
      } else return null;
    if (e !== null && t.child !== e.child)
      throw Error(c(153));
    if (t.child !== null) {
      for (e = t.child, n = Ll(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null; )
        e = e.sibling, n = n.sibling = Ll(e, e.pendingProps), n.return = t;
      n.sibling = null;
    }
    return t.child;
  }
  function Zs(e, t) {
    return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && no(e)));
  }
  function Zy(e, t, n) {
    switch (t.tag) {
      case 3:
        qe(t, t.stateNode.containerInfo), va(t, Ut, e.memoizedState.cache), $a();
        break;
      case 27:
      case 5:
        ge(t);
        break;
      case 4:
        qe(t, t.stateNode.containerInfo);
        break;
      case 10:
        va(
          t,
          t.type,
          t.memoizedProps.value
        );
        break;
      case 31:
        if (t.memoizedState !== null)
          return t.flags |= 128, ys(t), null;
        break;
      case 13:
        var l = t.memoizedState;
        if (l !== null) {
          if (l.dehydrated !== null)
            return ba(t), t.flags |= 128, null;
          l = tu(
            e,
            t,
            n,
            !1
          );
          var u = t.child.childLanes;
          return l || (n & u) !== 0 ? sg(e, t, n) : (ba(t), e = Ql(
            e,
            t,
            n
          ), e !== null ? e.sibling : null);
        }
        ba(t);
        break;
      case 19:
        if (t.flags & 128)
          return Is(
            e,
            t,
            n
          );
        if (u = (e.flags & 128) !== 0, l = (n & t.childLanes) !== 0, l || (tu(
          e,
          t,
          n,
          !1
        ), l = (n & t.childLanes) !== 0), u) {
          if (l)
            return Is(
              e,
              t,
              n
            );
          t.flags |= 128;
        }
        if (u = t.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), Ji(t, $t.current), l) break;
        return null;
      case 22:
        return t.lanes = 0, ag(
          e,
          t,
          n,
          t.pendingProps
        );
      case 24:
        va(t, Ut, e.memoizedState.cache);
    }
    return Ql(e, t, n);
  }
  function gg(e, t, n) {
    if (e !== null)
      if (e.memoizedProps !== t.pendingProps)
        Bt = !0;
      else {
        if (!Zs(e, n) && (t.flags & 128) === 0)
          return Bt = !1, Zy(
            e,
            t,
            n
          );
        Bt = (e.flags & 131072) !== 0;
      }
    else
      Bt = !1, Ke && (t.flags & 1048576) !== 0 && K0(t, qi, t.index);
    switch (t.lanes = 0, t.tag) {
      case 16:
        e: {
          var l = t.pendingProps;
          if (e = uu(t.elementType), t.type = e, typeof e == "function")
            es(e) ? (l = cu(e, l), t.tag = 1, t = og(
              null,
              t,
              e,
              l,
              n
            )) : (t.tag = 0, t = qs(
              null,
              t,
              e,
              l,
              n
            ));
          else {
            if (e != null) {
              var u = e.$$typeof;
              if (u === I) {
                t.tag = 11, t = tg(
                  null,
                  t,
                  e,
                  l,
                  n
                );
                break e;
              } else if (u === ie) {
                t.tag = 14, t = ng(
                  null,
                  t,
                  e,
                  l,
                  n
                );
                break e;
              } else if (u === oe) {
                t.tag = 10, t.type = e, t = vg(
                  null,
                  t,
                  n
                );
                break e;
              }
            }
            throw t = ue(e) || e, Error(c(306, t, ""));
          }
        }
        return t;
      case 0:
        return qs(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 1:
        return l = t.type, u = cu(
          l,
          t.pendingProps
        ), og(
          e,
          t,
          l,
          u,
          n
        );
      case 3:
        e: {
          if (qe(
            t,
            t.stateNode.containerInfo
          ), e === null) throw Error(c(387));
          l = t.pendingProps;
          var i = t.memoizedState;
          u = i.element, vs(e, t), ki(t, l, null, n);
          var s = t.memoizedState;
          if (l = s.cache, va(t, Ut, l), l !== i.cache && rs(
            t,
            [Ut],
            n,
            !0
          ), Zi(), l = s.element, i.isDehydrated)
            if (i = {
              element: l,
              isDehydrated: !1,
              cache: s.cache
            }, t.updateQueue.baseState = i, t.memoizedState = i, t.flags & 256) {
              t = cg(
                e,
                t,
                l,
                n
              );
              break e;
            } else if (l !== u) {
              u = Qn(
                Error(c(424)),
                t
              ), Yi(u), t = cg(
                e,
                t,
                l,
                n
              );
              break e;
            } else
              for (e = t.stateNode.containerInfo, e.nodeType === 9 ? e = e.body : e = e.nodeName === "HTML" ? e.ownerDocument.body : e, ht = Jn(e.firstChild), Qt = t, Ke = !0, fa = null, Zn = !0, n = av(
                t,
                null,
                l,
                n
              ), t.child = n; n; )
                n.flags = n.flags & -3 | 134221824, n = n.sibling;
          else {
            if ($a(), l === u) {
              t = Ql(
                e,
                t,
                n
              );
              break e;
            }
            qt(e, t, l, n);
          }
          t = t.child;
        }
        return t;
      case 26:
        return ku(e, t), e === null ? (n = Vm(
          t.type,
          null,
          t.pendingProps,
          null
        )) ? t.memoizedState = n : Ke || (t.stateNode = ym(
          t.type,
          t.pendingProps,
          Re.current,
          t
        )) : t.memoizedState = Vm(
          t.type,
          e.memoizedProps,
          t.pendingProps,
          e.memoizedState
        ), null;
      case 27:
        return ge(t), e === null && Ke && (l = t.stateNode = Um(
          t.type,
          t.pendingProps,
          Re.current
        ), Qt = t, Zn = !0, u = ht, Na(t.type) ? (Qf = u, ht = Jn(l.firstChild)) : ht = u), qt(
          e,
          t,
          t.pendingProps.children,
          n
        ), ku(e, t), e === null && (t.flags |= 4194304), t.child;
      case 5:
        return e === null && Ke && ((u = l = ht) && (l = Yb(
          l,
          t.type,
          t.pendingProps,
          Zn
        ), l !== null ? (t.stateNode = l, Qt = t, ht = Jn(l.firstChild), Zn = !1, u = !0) : u = !1), u || da(t)), ge(t), u = t.type, i = t.pendingProps, s = e !== null ? e.memoizedProps : null, l = i.children, Uf(u, i) ? l = null : s !== null && Uf(u, s) && (t.flags |= 32), t.memoizedState !== null && (u = Es(
          e,
          t,
          Hy,
          null,
          null,
          n
        ), di._currentValue = u), ku(e, t), qt(e, t, l, n), t.child;
      case 6:
        return e === null && Ke && ((e = n = ht) && (n = Gb(
          n,
          t.pendingProps,
          Zn
        ), n !== null ? (t.stateNode = n, Qt = t, ht = null, e = !0) : e = !1), e || da(t)), null;
      case 13:
        return sg(e, t, n);
      case 4:
        return qe(
          t,
          t.stateNode.containerInfo
        ), l = t.pendingProps, e === null ? t.child = ru(
          t,
          null,
          l,
          n
        ) : qt(e, t, l, n), t.child;
      case 11:
        return tg(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 7:
        return l = t.pendingProps, ku(e, t), qt(e, t, l, n), t.child;
      case 8:
        return qt(
          e,
          t,
          t.pendingProps.children,
          n
        ), t.child;
      case 12:
        return qt(
          e,
          t,
          t.pendingProps.children,
          n
        ), t.child;
      case 10:
        return vg(e, t, n);
      case 9:
        return u = t.type._context, l = t.pendingProps.children, nu(t), u = Pt(u), l = l(u), t.flags |= 1, qt(e, t, l, n), t.child;
      case 14:
        return ng(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 15:
        return lg(
          e,
          t,
          t.type,
          t.pendingProps,
          n
        );
      case 19:
        return Is(e, t, n);
      case 31:
        return Ky(e, t, n);
      case 22:
        return ag(
          e,
          t,
          n,
          t.pendingProps
        );
      case 24:
        return nu(t), l = Pt(Ut), e === null ? (u = ss(), u === null && (u = gt, i = os(), u.pooledCache = i, i.refCount++, i !== null && (u.pooledCacheLanes |= n), u = i), t.memoizedState = { parent: l, cache: u }, ds(t), va(t, Ut, u)) : ((e.lanes & n) !== 0 && (vs(e, t), ki(t, null, null, n), Zi()), u = e.memoizedState, i = t.memoizedState, u.parent !== l ? (u = { parent: l, cache: l }, t.memoizedState = u, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = u), va(t, Ut, l)) : (l = i.cache, va(t, Ut, l), l !== u.cache && rs(
          t,
          [Ut],
          n,
          !0
        ))), qt(
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
        }), l = t.pendingProps, l.name != null && l.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : Ke && $r(t), e !== null && e.memoizedProps.name !== l.name ? t.flags |= 4194816 : ku(e, t), qt(e, t, l.children, n), t.child;
      case 29:
        throw t.pendingProps;
    }
    throw Error(c(156, t.tag));
  }
  function Kl(e) {
    e.flags |= 4;
  }
  function ks(e, t, n, l, u) {
    var i;
    if ((i = (e.mode & 32) !== 0) && (i = n === null ? Xm(t, l) : Xm(t, l) && (l.src !== n.src || l.srcSet !== n.srcSet)), i) {
      if (e.flags |= 16777216, (u & 335544128) === u)
        if (e.stateNode.complete) e.flags |= 8192;
        else if (Jg()) e.flags |= 8192;
        else
          throw iu = io, fs;
    } else e.flags &= -16777217;
  }
  function mg(e, t) {
    if (t.type !== "stylesheet" || (t.state.loading & 4) !== 0)
      e.flags &= -16777217;
    else if (e.flags |= 16777216, !Qm(t))
      if (Jg()) e.flags |= 8192;
      else
        throw iu = io, fs;
  }
  function Ao(e, t) {
    t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? ll() : 536870912, e.lanes |= t, $u |= t);
  }
  function er(e, t) {
    if (!Ke)
      switch (e.tailMode) {
        case "visible":
          break;
        case "collapsed":
          for (var n = e.tail, l = null; n !== null; )
            n.alternate !== null && (l = n), n = n.sibling;
          l === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : l.sibling = null;
          break;
        default:
          for (t = e.tail, n = null; t !== null; )
            t.alternate !== null && (n = t), t = t.sibling;
          n === null ? e.tail = null : n.sibling = null;
      }
  }
  function pt(e) {
    var t = e.alternate !== null && e.alternate.child === e.child, n = 0, l = 0;
    if (t)
      for (var u = e.child; u !== null; )
        n |= u.lanes | u.childLanes, l |= u.subtreeFlags & 1206910976, l |= u.flags & 1206910976, u.return = e, u = u.sibling;
    else
      for (u = e.child; u !== null; )
        n |= u.lanes | u.childLanes, l |= u.subtreeFlags, l |= u.flags, u.return = e, u = u.sibling;
    return e.subtreeFlags |= l, e.childLanes = n, t;
  }
  function ky(e, t, n) {
    var l = t.pendingProps;
    switch (ls(t), t.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return pt(t), null;
      case 1:
        return pt(t), null;
      case 3:
        return n = t.stateNode, l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), Yl(Ut), ft(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (Yu(t) ? Kl(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, us())), pt(t), null;
      case 26:
        var u = t.type, i = t.memoizedState;
        return e === null ? (Kl(t), i !== null ? (pt(t), mg(t, i)) : (pt(t), ks(
          t,
          u,
          null,
          l,
          n
        ))) : i ? i !== e.memoizedState ? (Kl(t), pt(t), mg(t, i)) : (pt(t), t.flags &= -16777217) : (e = e.memoizedProps, e !== l && Kl(t), pt(t), ks(
          t,
          u,
          e,
          l,
          n
        )), null;
      case 27:
        if (Se(t), n = Re.current, u = t.type, e !== null && t.stateNode != null)
          e.memoizedProps !== l && Kl(t);
        else {
          if (!l) {
            if (t.stateNode === null)
              throw Error(c(166));
            return pt(t), t.subtreeFlags &= -33554433, null;
          }
          e = Te.current, Yu(t) ? Z0(t) : (e = Um(u, l, n), t.stateNode = e, Kl(t));
        }
        return pt(t), t.subtreeFlags &= -33554433, null;
      case 5:
        if (Se(t), u = t.type, e !== null && t.stateNode != null)
          e.memoizedProps !== l && Kl(t);
        else {
          if (!l) {
            if (t.stateNode === null)
              throw Error(c(166));
            return pt(t), t.subtreeFlags &= -33554433, null;
          }
          if (i = Te.current, Yu(t))
            Z0(t);
          else {
            var s = fr(
              Re.current
            );
            switch (i) {
              case 1:
                i = s.createElementNS(
                  "http://www.w3.org/2000/svg",
                  u
                );
                break;
              case 2:
                i = s.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  u
                );
                break;
              default:
                switch (u) {
                  case "svg":
                    i = s.createElementNS(
                      "http://www.w3.org/2000/svg",
                      u
                    );
                    break;
                  case "math":
                    i = s.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      u
                    );
                    break;
                  case "script":
                    i = s.createElement("div"), i.innerHTML = "<script><\/script>", i = i.removeChild(
                      i.firstChild
                    );
                    break;
                  case "select":
                    i = typeof l.is == "string" ? s.createElement("select", {
                      is: l.is
                    }) : s.createElement("select"), l.multiple ? i.multiple = !0 : l.size && (i.size = l.size);
                    break;
                  default:
                    i = typeof l.is == "string" ? s.createElement(u, { is: l.is }) : s.createElement(u);
                }
            }
            i[Tt] = t, i[kt] = l;
            e: for (s = t.child; s !== null; ) {
              if (s.tag === 5 || s.tag === 6)
                i.appendChild(s.stateNode);
              else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
                s.child.return = s, s = s.child;
                continue;
              }
              if (s === t) break e;
              for (; s.sibling === null; ) {
                if (s.return === null || s.return === t)
                  break e;
                s = s.return;
              }
              s.sibling.return = s.return, s = s.sibling;
            }
            t.stateNode = i;
            e: switch (tn(i, u, l), u) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                l = !!l.autoFocus;
                break e;
              case "img":
                l = !0;
                break e;
              default:
                l = !1;
            }
            l && Kl(t);
          }
        }
        return pt(t), t.subtreeFlags &= -33554433, ks(
          t,
          t.type,
          e === null ? null : e.memoizedProps,
          t.pendingProps,
          n
        ), null;
      case 6:
        if (e && t.stateNode != null)
          e.memoizedProps !== l && Kl(t);
        else {
          if (typeof l != "string" && t.stateNode === null)
            throw Error(c(166));
          if (e = Re.current, Yu(t)) {
            if (e = t.stateNode, n = t.memoizedProps, l = null, u = Qt, u !== null)
              switch (u.tag) {
                case 27:
                case 5:
                  l = u.memoizedProps;
              }
            e[Tt] = t, e = !!(e.nodeValue === n || l !== null && l.suppressHydrationWarning === !0 || gm(e.nodeValue, n)), e || da(t, !0);
          } else
            e = fr(e).createTextNode(
              l
            ), e[Tt] = t, t.stateNode = e;
        }
        return pt(t), null;
      case 31:
        if (n = t.memoizedState, e === null || e.memoizedState !== null) {
          if (l = Yu(t), n !== null) {
            if (e === null) {
              if (!l) throw Error(c(318));
              if (e = t.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(c(557));
              e[Tt] = t;
            } else
              $a(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
            pt(t), e = !1;
          } else
            n = us(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
          if (!e)
            return t.flags & 256 ? (_n(t), t) : (_n(t), null);
          if ((t.flags & 128) !== 0)
            throw Error(c(558));
        }
        return pt(t), null;
      case 13:
        if (l = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
          if (u = Yu(t), l !== null && l.dehydrated !== null) {
            if (e === null) {
              if (!u) throw Error(c(318));
              if (u = t.memoizedState, u = u !== null ? u.dehydrated : null, !u) throw Error(c(317));
              u[Tt] = t;
            } else
              $a(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
            pt(t), u = !1;
          } else
            u = us(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = u), u = !0;
          if (!u)
            return t.flags & 256 ? (_n(t), t) : (_n(t), null);
        }
        return _n(t), (t.flags & 128) !== 0 ? (t.lanes = n, t) : (n = l !== null, e = e !== null && e.memoizedState !== null, n && (l = t.child, u = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (u = l.alternate.memoizedState.cachePool.pool), i = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (i = l.memoizedState.cachePool.pool), i !== u && (l.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), Ao(t, t.updateQueue), pt(t), null);
      case 4:
        return ft(), e === null && Mf(t.stateNode.containerInfo), t.flags |= 67108864, pt(t), null;
      case 10:
        return Yl(t.type), pt(t), null;
      case 19:
        if (bs(t), l = t.memoizedState, l === null) return pt(t), null;
        if (u = (t.flags & 128) !== 0, i = l.rendering, i === null)
          if (u) er(l, !1);
          else {
            if (Ot !== 0 || e !== null && (e.flags & 128) !== 0)
              for (e = t.child; e !== null; ) {
                if (i = so(e), i !== null) {
                  for (t.flags |= 128, er(l, !1), e = i.updateQueue, t.updateQueue = e, Ao(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null; )
                    G0(n, e), n = n.sibling;
                  return Ji(
                    t,
                    $t.current & 1 | 2
                  ), Ke && Vl(t, l.treeForkCount), t.child;
                }
                e = e.sibling;
              }
            l.tail !== null && Zt() > Lo && (t.flags |= 128, u = !0, er(l, !1), t.lanes = 4194304);
          }
        else {
          if (!u)
            if (e = so(i), e !== null) {
              if (t.flags |= 128, u = !0, e = e.updateQueue, t.updateQueue = e, Ao(t, e), er(l, !0), l.tail === null && l.tailMode !== "collapsed" && l.tailMode !== "visible" && !i.alternate && !Ke)
                return pt(t), null;
            } else
              2 * Zt() - l.renderingStartTime > Lo && n !== 536870912 && (t.flags |= 128, u = !0, er(l, !1), t.lanes = 4194304);
          l.isBackwards ? (i.sibling = t.child, t.child = i) : (e = l.last, e !== null ? e.sibling = i : t.child = i, l.last = i);
        }
        if (l.tail !== null) {
          e = l.tail;
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
          return l.rendering = e, l.tail = e.sibling, l.renderingStartTime = Zt(), e.sibling = null, i = $t.current, i = u ? i & 1 | 2 : i & 1, l.tailMode === "visible" || l.tailMode === "collapsed" || !n || Ke ? Ji(t, i) : (n = i, Be(Wt, t), Be($t, n), on === null && (on = t)), Ke && Vl(t, l.treeForkCount), e;
        }
        return pt(t), null;
      case 22:
      case 23:
        return _n(t), ps(), l = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== l && (t.flags |= 8192) : l && (t.flags |= 8192), l ? (n & 536870912) !== 0 && (t.flags & 128) === 0 && (pt(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : pt(t), n = t.updateQueue, n !== null && Ao(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), l = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), l !== n && (t.flags |= 2048), e !== null && _e(au), null;
      case 24:
        return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), Yl(Ut), pt(t), null;
      case 25:
        return null;
      case 30:
        return t.flags |= 33554432, pt(t), null;
    }
    throw Error(c(156, t.tag));
  }
  function Jy(e, t) {
    switch (ls(t), t.tag) {
      case 1:
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 3:
        return Yl(Ut), ft(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
      case 26:
      case 27:
      case 5:
        return Se(t), null;
      case 31:
        if (t.memoizedState !== null) {
          if (_n(t), t.alternate === null)
            throw Error(c(340));
          $a();
        }
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 13:
        if (_n(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
          if (t.alternate === null)
            throw Error(c(340));
          $a();
        }
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 19:
        return bs(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
      case 4:
        return ft(), null;
      case 10:
        return Yl(t.type), null;
      case 22:
      case 23:
        return _n(t), ps(), e !== null && _e(au), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 24:
        return Yl(Ut), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function hg(e, t) {
    switch (ls(t), t.tag) {
      case 3:
        Yl(Ut), ft();
        break;
      case 26:
      case 27:
      case 5:
        Se(t);
        break;
      case 4:
        ft();
        break;
      case 31:
        t.memoizedState !== null && _n(t);
        break;
      case 13:
        _n(t);
        break;
      case 19:
        bs(t);
        break;
      case 10:
        Yl(t.type);
        break;
      case 22:
      case 23:
        _n(t), ps(), e !== null && _e(au);
        break;
      case 24:
        Yl(Ut);
    }
  }
  function tr(e, t) {
    try {
      var n = t.updateQueue, l = n !== null ? n.lastEffect : null;
      if (l !== null) {
        var u = l.next;
        n = u;
        do {
          if ((n.tag & e) === e) {
            l = void 0;
            var i = n.create, s = n.inst;
            l = i(), s.destroy = l;
          }
          n = n.next;
        } while (n !== u);
      }
    } catch (v) {
      ct(t, t.return, v);
    }
  }
  function Ea(e, t, n) {
    try {
      var l = t.updateQueue, u = l !== null ? l.lastEffect : null;
      if (u !== null) {
        var i = u.next;
        l = i;
        do {
          if ((l.tag & e) === e) {
            var s = l.inst, v = s.destroy;
            if (v !== void 0) {
              s.destroy = void 0, u = t;
              var T = n, w = v;
              try {
                w();
              } catch (X) {
                ct(
                  u,
                  T,
                  X
                );
              }
            }
          }
          l = l.next;
        } while (l !== i);
      }
    } catch (X) {
      ct(t, t.return, X);
    }
  }
  function pg(e) {
    var t = e.updateQueue;
    if (t !== null) {
      var n = e.stateNode;
      try {
        iv(t, n);
      } catch (l) {
        ct(e, e.return, l);
      }
    }
  }
  function yg(e, t, n) {
    n.props = cu(
      e.type,
      e.memoizedProps
    ), n.state = e.memoizedState;
    try {
      n.componentWillUnmount();
    } catch (l) {
      ct(e, t, l);
    }
  }
  function yl(e, t) {
    try {
      var n = e.ref;
      if (n !== null) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            var l = e.stateNode;
            break;
          case 30:
            var u = e.stateNode, i = Hl(e.memoizedProps, u);
            (u.ref === null || u.ref.name !== i) && (u.ref = Rm(i)), l = u.ref;
            break;
          case 7:
            if (e.stateNode === null) {
              var s = new Bn(e);
              g(
                e.child,
                !1,
                Vb,
                s,
                void 0,
                void 0
              ), e.stateNode = s;
            }
            l = e.stateNode;
            break;
          default:
            l = e.stateNode;
        }
        typeof n == "function" ? e.refCleanup = n(l) : n.current = l;
      }
    } catch (v) {
      ct(e, t, v);
    }
  }
  function en(e, t) {
    var n = e.ref, l = e.refCleanup;
    if (n !== null)
      if (typeof l == "function")
        try {
          l();
        } catch (u) {
          ct(e, t, u);
        } finally {
          e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
        }
      else if (typeof n == "function")
        try {
          n(null);
        } catch (u) {
          ct(e, t, u);
        }
      else n.current = null;
  }
  function Oo(e, t) {
    if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null)
      for (var n = 0; n < t.length; n++)
        Dm(
          e.stateNode,
          t[n]
        );
  }
  function bg(e) {
    for (var t = e.return; t !== null && (Fs(t) && Dm(e.stateNode, t.stateNode), !Js(t)); )
      t = t.return;
  }
  function nr(e) {
    for (var t = e.return; t !== null && (Fs(t) && qb(e.stateNode, t.stateNode), !Js(t)); )
      t = t.return;
  }
  function Js(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 27;
  }
  function Fs(e) {
    return e && e.tag === 7 && e.stateNode !== null;
  }
  function Ps(e) {
    var t = e.type, n = e.memoizedProps, l = e.stateNode;
    try {
      e: switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          n.autoFocus && l.focus();
          break e;
        case "img":
          n.src ? l.src = n.src : n.srcSet && (l.srcset = n.srcSet);
      }
    } catch (u) {
      ct(e, e.return, u);
    }
  }
  function Ws(e, t, n) {
    try {
      var l = e.stateNode;
      Eb(l, e.type, n, t), l[kt] = t;
    } catch (u) {
      ct(e, e.return, u);
    }
  }
  function Sg(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Na(e.type) || e.tag === 4;
  }
  function $s(e) {
    e: for (; ; ) {
      for (; e.sibling === null; ) {
        if (e.return === null || Sg(e.return)) return null;
        e = e.return;
      }
      for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
        if (e.tag === 27 && Na(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
        e.child.return = e, e = e.child;
      }
      if (!(e.flags & 2)) return e.stateNode;
    }
  }
  function ef(e, t, n, l) {
    var u = e.tag;
    if (u === 5 || u === 6)
      u = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(u, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(u), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = dn)), Oo(e, l), Ne = !0;
    else if (u !== 4 && (u === 27 && (Oo(e, l), l = null, Na(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null))
      for (ef(
        e,
        t,
        n,
        l
      ), e = e.sibling; e !== null; )
        ef(
          e,
          t,
          n,
          l
        ), e = e.sibling;
  }
  function No(e, t, n, l) {
    var u = e.tag;
    if (u === 5 || u === 6)
      u = e.stateNode, t ? n.insertBefore(u, t) : n.appendChild(u), Oo(e, l), Ne = !0;
    else if (u !== 4 && (u === 27 && (Oo(e, l), l = null, Na(e.type) && (n = e.stateNode)), e = e.child, e !== null))
      for (No(
        e,
        t,
        n,
        l
      ), e = e.sibling; e !== null; )
        No(
          e,
          t,
          n,
          l
        ), e = e.sibling;
  }
  function Eg(e) {
    var t = e.stateNode, n = e.memoizedProps;
    try {
      for (var l = e.type, u = t.attributes; u.length; )
        t.removeAttributeNode(u[0]);
      tn(t, l, n), t[Tt] = e, t[kt] = n;
    } catch (i) {
      ct(e, e.return, i);
    }
  }
  var zo = !1, wn = null;
  function Tg(e) {
    (e.tag === 30 || (e.subtreeFlags & 33554432) !== 0) && (zo = !0);
  }
  var bl = null;
  function xg() {
    var e = bl;
    return bl = null, e;
  }
  var En = 0;
  function Ju(e, t, n, l, u) {
    return En = 0, Cg(
      e.child,
      t,
      n,
      l,
      u
    );
  }
  function Cg(e, t, n, l, u) {
    for (var i = !1; e !== null; ) {
      if (e.tag === 5) {
        var s = e.stateNode;
        if (l !== null) {
          var v = Lf(s);
          l.push(v), v.view && (i = !0);
        } else
          i || Lf(s).view && (i = !0);
        zo = !0, xm(
          s,
          En === 0 ? t : t + "_" + En,
          n
        ), En++;
      } else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && u || Cg(
        e.child,
        t,
        n,
        l,
        u
      ) && (i = !0));
      e = e.sibling;
    }
    return i;
  }
  function Sl(e, t) {
    for (; e !== null; )
      e.tag === 5 ? Cm(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || Sl(
        e.child,
        t
      )), e = e.sibling;
  }
  function Mo(e) {
    if ((e.subtreeFlags & 18874368) !== 0)
      for (e = e.child; e !== null; ) {
        if ((e.tag !== 22 || e.memoizedState === null) && (Mo(e), e.tag === 30 && (e.flags & 18874368) !== 0 && e.stateNode.paired)) {
          var t = e.memoizedProps;
          if (t.name == null || t.name === "auto")
            throw Error(c(544));
          var n = t.name;
          t = Bl(t.default, t.share), t !== "none" && (Ju(
            e,
            n,
            t,
            null,
            !1
          ) || Sl(e.child, !1));
        }
        e = e.sibling;
      }
  }
  function tf(e, t) {
    if (e.tag === 30) {
      var n = e.stateNode, l = e.memoizedProps, u = Hl(l, n), i = Bl(
        l.default,
        n.paired ? l.share : l.enter
      );
      i !== "none" ? Ju(e, u, i, null, !1) ? (Mo(e), n.paired || t || li(e, l.onEnter)) : Sl(e.child, !1) : Mo(e);
    } else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; )
        tf(e, t), e = e.sibling;
    else Mo(e);
  }
  function nf(e) {
    if (wn !== null && wn.size !== 0) {
      var t = wn;
      if ((e.subtreeFlags & 18874368) !== 0)
        for (e = e.child; e !== null; ) {
          if (e.tag !== 22 || e.memoizedState === null) {
            if (e.tag === 30 && (e.flags & 18874368) !== 0) {
              var n = e.memoizedProps, l = n.name;
              if (l != null && l !== "auto") {
                var u = t.get(l);
                if (u !== void 0) {
                  var i = Bl(
                    n.default,
                    n.share
                  );
                  if (i !== "none" && (Ju(
                    e,
                    l,
                    i,
                    null,
                    !1
                  ) ? (i = e.stateNode, u.paired = i, i.paired = u, li(e, n.onShare)) : Sl(e.child, !1)), t.delete(l), t.size === 0) break;
                }
              }
            }
            nf(e);
          }
          e = e.sibling;
        }
    }
  }
  function lf(e) {
    if (e.tag === 30) {
      var t = e.memoizedProps, n = Hl(t, e.stateNode), l = wn !== null ? wn.get(n) : void 0, u = Bl(
        t.default,
        l !== void 0 ? t.share : t.exit
      );
      u !== "none" && (Ju(e, n, u, null, !1) ? l !== void 0 ? (u = e.stateNode, l.paired = u, u.paired = l, wn.delete(n), li(e, t.onShare)) : li(e, t.onExit) : Sl(e.child, !1)), wn !== null && nf(e);
    } else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; )
        lf(e), e = e.sibling;
    else
      wn !== null && nf(e);
  }
  function Rg(e) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var t = e.memoizedProps, n = Hl(t, e.stateNode);
        t = Bl(t.default, t.update), e.flags &= -5, t !== "none" && Ju(
          e,
          n,
          t,
          e.memoizedState = [],
          !1
        );
      } else
        (e.subtreeFlags & 33554432) !== 0 && Rg(e);
      e = e.sibling;
    }
  }
  function af(e) {
    if ((e.subtreeFlags & 18874368) !== 0)
      for (e = e.child; e !== null; ) {
        if (e.tag !== 22 || e.memoizedState === null) {
          if (e.tag === 30 && (e.flags & 18874368) !== 0) {
            var t = e.stateNode;
            t.paired !== null && (t.paired = null, Sl(e.child, !1));
          }
          af(e);
        }
        e = e.sibling;
      }
  }
  function Do(e) {
    if (e.tag === 30)
      e.stateNode.paired = null, Sl(e.child, !1), af(e);
    else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; )
        Do(e), e = e.sibling;
    else af(e);
  }
  function Ag(e) {
    for (e = e.child; e !== null; )
      e.tag === 30 ? Sl(e.child, !1) : (e.subtreeFlags & 33554432) !== 0 && Ag(e), e = e.sibling;
  }
  function uf(e, t, n, l, u, i, s) {
    for (var v = !1; t !== null; ) {
      if (t.tag === 5) {
        var T = t.stateNode;
        if (i !== null && En < i.length) {
          var w = i[En], X = Lf(T);
          (w.view || X.view) && (v = !0);
          var J;
          if (J = (e.flags & 4) === 0)
            if (X.clip) J = !0;
            else {
              J = w.rect;
              var z = X.rect;
              J = J.y !== z.y || J.x !== z.x || J.height !== z.height || J.width !== z.width;
            }
          J && (e.flags |= 4), X.abs ? X = !w.abs : (w = w.rect, X = X.rect, X = w.height !== X.height || w.width !== X.width), X && (e.flags |= 32);
        } else e.flags |= 32;
        (e.flags & 4) !== 0 && xm(
          T,
          En === 0 ? n : n + "_" + En,
          u
        ), v && (e.flags & 4) !== 0 || (bl === null && (bl = []), bl.push(
          T,
          En === 0 ? l : l + "_" + En,
          t.memoizedProps
        )), En++;
      } else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && s ? e.flags |= t.flags & 32 : uf(
        e,
        t.child,
        n,
        l,
        u,
        i,
        s
      ) && (v = !0));
      t = t.sibling;
    }
    return v;
  }
  function Og(e, t) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var n = e.memoizedProps, l = e.stateNode, u = Hl(n, l), i = Bl(n.default, n.update), s;
        s = e.memoizedState, e.memoizedState = null, l = e;
        var v = e.child;
        En = 0, u = uf(
          l,
          v,
          u,
          u,
          i,
          s,
          !1
        ), (e.flags & 4) !== 0 && u && li(e, n.onUpdate);
      } else
        (e.subtreeFlags & 33554432) !== 0 && Og(e);
      e = e.sibling;
    }
  }
  var Kt = !1, it = !1, El = !1, rf = !1, Ng = typeof WeakSet == "function" ? WeakSet : Set, It = null, Tl = !1, lr = !1, _o = !1, of = !1;
  function Fy(e, t, n) {
    if (e = e.containerInfo, wf = vi, e = _0(e), Zc(e)) {
      if ("selectionStart" in e)
        var l = {
          start: e.selectionStart,
          end: e.selectionEnd
        };
      else
        e: {
          l = (l = e.ownerDocument) && l.defaultView || window;
          var u = l.getSelection && l.getSelection();
          if (u && u.rangeCount !== 0) {
            l = u.anchorNode;
            var i = u.anchorOffset, s = u.focusNode;
            u = u.focusOffset;
            try {
              l.nodeType, s.nodeType;
            } catch {
              l = null;
              break e;
            }
            var v = 0, T = -1, w = -1, X = 0, J = 0, z = e, B = null;
            t: for (; ; ) {
              for (var de; z !== l || i !== 0 && z.nodeType !== 3 || (T = v + i), z !== s || u !== 0 && z.nodeType !== 3 || (w = v + u), z.nodeType === 3 && (v += z.nodeValue.length), (de = z.firstChild) !== null; )
                B = z, z = de;
              for (; ; ) {
                if (z === e) break t;
                if (B === l && ++X === i && (T = v), B === s && ++J === u && (w = v), (de = z.nextSibling) !== null) break;
                z = B, B = z.parentNode;
              }
              z = de;
            }
            l = T === -1 || w === -1 ? null : { start: T, end: w };
          } else l = null;
        }
      l = l || { start: 0, end: 0 };
    } else l = null;
    for (jf = { focusedElem: e, selectionRange: l }, vi = !1, n = (n & 335544064) === n, It = t, t = n ? 9270 : 1024; It !== null; ) {
      if (e = It, n && (l = e.deletions, l !== null))
        for (i = 0; i < l.length; i++)
          n && lf(l[i]);
      if (e.alternate === null && (e.flags & 2) !== 0)
        n && Tg(e), wo(n);
      else {
        if (e.tag === 22) {
          if (l = e.alternate, e.memoizedState !== null) {
            l !== null && l.memoizedState === null && n && lf(l), wo(n);
            continue;
          } else if (l !== null && l.memoizedState !== null) {
            n && Tg(e), wo(n);
            continue;
          }
        }
        l = e.child, (e.subtreeFlags & t) !== 0 && l !== null ? (l.return = e, It = l) : (n && Rg(e), wo(n));
      }
    }
    wn = null;
  }
  function wo(e) {
    for (; It !== null; ) {
      var t = It, n = e, l = t.alternate, u = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if ((u & 1024) !== 0 && l !== null) {
            n = void 0, u = l.memoizedProps, l = l.memoizedState;
            var i = t.stateNode;
            try {
              var s = cu(
                t.type,
                u
              );
              n = i.getSnapshotBeforeUpdate(
                s,
                l
              ), i.__reactInternalSnapshotBeforeUpdate = n;
            } catch (v) {
              ct(t, t.return, v);
            }
          }
          break;
        case 3:
          if ((u & 1024) !== 0) {
            if (l = t.stateNode.containerInfo, n = l.nodeType, n === 9)
              Yf(l);
            else if (n === 1)
              switch (l.nodeName) {
                case "HEAD":
                case "HTML":
                case "BODY":
                  Yf(l);
                  break;
                default:
                  l.textContent = "";
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
          n && l !== null && (n = Hl(
            l.memoizedProps,
            l.stateNode
          ), u = t.memoizedProps, u = Bl(u.default, u.update), u !== "none" && Ju(
            l,
            n,
            u,
            l.memoizedState = [],
            !0
          ));
          break;
        default:
          if ((u & 1024) !== 0) throw Error(c(163));
      }
      if (l = t.sibling, l !== null) {
        l.return = t.return, It = l;
        break;
      }
      It = t.return;
    }
  }
  function zg(e, t, n) {
    var l = n.flags;
    switch (n.tag) {
      case 0:
      case 11:
      case 15:
        xl(e, n), l & 4 && tr(5, n);
        break;
      case 1:
        if (xl(e, n), l & 4)
          if (e = n.stateNode, t === null)
            try {
              e.componentDidMount();
            } catch (s) {
              ct(n, n.return, s);
            }
          else {
            var u = cu(
              n.type,
              t.memoizedProps
            );
            t = t.memoizedState;
            try {
              e.componentDidUpdate(
                u,
                t,
                e.__reactInternalSnapshotBeforeUpdate
              );
            } catch (s) {
              ct(
                n,
                n.return,
                s
              );
            }
          }
        l & 64 && pg(n), l & 512 && yl(n, n.return);
        break;
      case 3:
        if (xl(e, n), l & 64 && (e = n.updateQueue, e !== null)) {
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
            iv(e, t);
          } catch (s) {
            ct(n, n.return, s);
          }
        }
        break;
      case 27:
        t === null && l & 4 && Eg(n);
      case 26:
      case 5:
        xl(e, n), t === null && l & 4 && Ps(n), l & 512 && yl(n, n.return);
        break;
      case 12:
        xl(e, n);
        break;
      case 31:
        xl(e, n), l & 4 && wg(e, n);
        break;
      case 13:
        xl(e, n), l & 4 && jg(e, n), l & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = ob.bind(
          null,
          n
        ), Xb(e, n))));
        break;
      case 22:
        if (l = n.memoizedState !== null || Kt, !l) {
          var i = t !== null && t.memoizedState !== null || it;
          t = Kt, u = it, Kt = l, (it = i) && !u ? (l = 2, (n.subtreeFlags & 8772) !== 0 && (l |= 1), cl(
            e,
            n,
            l
          )) : xl(e, n), Kt = t, it = u;
        }
        break;
      case 30:
        xl(e, n), l & 512 && yl(n, n.return);
        break;
      case 7:
        l & 512 && yl(n, n.return);
      default:
        xl(e, n);
    }
  }
  function cf(e, t) {
    for (e = e.child; e !== null; )
      Mg(e, t), e = e.sibling;
  }
  function Mg(e, t) {
    switch (e.tag) {
      case 5:
      case 26:
        try {
          var n = e.stateNode;
          if (t) {
            var l = n.style;
            typeof l.setProperty == "function" ? l.setProperty("display", "none", "important") : l.display = "none";
          } else {
            var u = e.stateNode, i = e.memoizedProps.style, s = i != null && i.hasOwnProperty("display") ? i.display : null;
            u.style.display = s == null || typeof s == "boolean" ? "" : ("" + s).trim();
          }
        } catch (T) {
          ct(e, e.return, T);
        }
        sf(e, t);
        break;
      case 6:
        try {
          e.stateNode.nodeValue = t ? "" : e.memoizedProps, Ne = !0;
        } catch (T) {
          ct(e, e.return, T);
        }
        break;
      case 18:
        try {
          var v = e.stateNode;
          t ? Tm(v, !0) : Tm(e.stateNode, !1);
        } catch (T) {
          ct(e, e.return, T);
        }
        break;
      case 22:
      case 23:
        e.memoizedState === null && cf(e, t);
        break;
      default:
        cf(e, t);
    }
  }
  function sf(e, t) {
    if (e.subtreeFlags & 67108864)
      for (e = e.child; e !== null; ) {
        e: {
          var n = e, l = t;
          switch (n.tag) {
            case 4:
              Mg(n, l);
              break e;
            case 22:
              n.memoizedState === null && sf(n, l);
              break e;
            default:
              sf(n, l);
          }
        }
        e = e.sibling;
      }
  }
  function Dg(e) {
    var t = e.alternate;
    t !== null && (e.alternate = null, Dg(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && zu(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
  }
  var bt = null, Tn = !1;
  function rl(e, t, n) {
    for (n = n.child; n !== null; )
      _g(e, t, n), n = n.sibling;
  }
  function _g(e, t, n) {
    if (un && typeof un.onCommitFiberUnmount == "function")
      try {
        un.onCommitFiberUnmount($l, n);
      } catch {
      }
    switch (n.tag) {
      case 26:
        it || en(n, t), rl(
          e,
          t,
          n
        ), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !it && (n = n.stateNode, n.parentNode.removeChild(n));
        break;
      case 27:
        it || en(n, t), nr(n);
        var l = bt, u = Tn;
        Na(n.type) && (bt = n.stateNode, Tn = !1), rl(
          e,
          t,
          n
        ), Hm(
          n.stateNode,
          n.type,
          n.memoizedProps
        ), bt = l, Tn = u;
        break;
      case 5:
        it || en(n, t), nr(n);
      case 6:
        if (n.tag === 6 && nr(n), l = bt, u = Tn, bt = null, rl(
          e,
          t,
          n
        ), bt = l, Tn = u, bt !== null)
          if (Tn)
            try {
              (bt.nodeType === 9 ? bt.body : bt.nodeName === "HTML" ? bt.ownerDocument.body : bt).removeChild(n.stateNode), Ne = !0;
            } catch (i) {
              ct(
                n,
                t,
                i
              );
            }
          else
            try {
              bt.removeChild(n.stateNode), Ne = !0;
            } catch (i) {
              ct(
                n,
                t,
                i
              );
            }
        break;
      case 18:
        bt !== null && (Tn ? (e = bt, Em(
          e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e,
          n.stateNode
        ), gi(e)) : Em(bt, n.stateNode));
        break;
      case 4:
        l = bt, u = Tn, bt = n.stateNode.containerInfo, Tn = !0, rl(
          e,
          t,
          n
        ), bt = l, Tn = u;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        Ea(2, n, t), it || Ea(4, n, t), rl(
          e,
          t,
          n
        );
        break;
      case 1:
        it || (en(n, t), l = n.stateNode, typeof l.componentWillUnmount == "function" && yg(
          n,
          t,
          l
        )), rl(
          e,
          t,
          n
        );
        break;
      case 21:
        rl(
          e,
          t,
          n
        );
        break;
      case 22:
        it = (l = it) || n.memoizedState !== null, rl(
          e,
          t,
          n
        ), it = l;
        break;
      case 30:
        en(n, t), rl(
          e,
          t,
          n
        );
        break;
      case 7:
        it || en(n, t), rl(
          e,
          t,
          n
        );
        break;
      default:
        rl(
          e,
          t,
          n
        );
    }
  }
  function wg(e, t) {
    if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
      e = e.dehydrated;
      try {
        gi(e);
      } catch (n) {
        ct(t, t.return, n);
      }
    }
  }
  function jg(e, t) {
    if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
      try {
        gi(e);
      } catch (n) {
        ct(t, t.return, n);
      }
  }
  function Py(e) {
    switch (e.tag) {
      case 31:
      case 13:
      case 19:
        var t = e.stateNode;
        return t === null && (t = e.stateNode = new Ng()), t;
      case 22:
        return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new Ng()), t;
      default:
        throw Error(c(435, e.tag));
    }
  }
  function jo(e, t) {
    var n = Py(e);
    t.forEach(function(l) {
      if (!n.has(l)) {
        n.add(l);
        var u = cb.bind(null, e, l);
        l.then(u, u);
      }
    });
  }
  function mn(e, t, n) {
    var l = t.deletions;
    if (l !== null)
      for (var u = 0; u < l.length; u++) {
        var i = l[u], s = e, v = t, T = v;
        e: for (; T !== null; ) {
          switch (T.tag) {
            case 27:
              if (Na(T.type)) {
                bt = T.stateNode, Tn = !1;
                break e;
              }
              break;
            case 5:
              bt = T.stateNode, Tn = !1;
              break e;
            case 3:
            case 4:
              bt = T.stateNode.containerInfo, Tn = !0;
              break e;
          }
          T = T.return;
        }
        if (bt === null) throw Error(c(160));
        _g(s, v, i), bt = null, Tn = !1, s = i.alternate, s !== null && (s.return = null), i.return = null;
      }
    if (t.subtreeFlags & 13886)
      for (t = t.child; t !== null; )
        Ug(t, e, n), t = t.sibling;
  }
  var ol = null;
  function Ug(e, t, n) {
    var l = e.alternate, u = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (u & 4 && (l = e.updateQueue, l = l !== null ? l.events : null, l !== null))
          for (var i = 0; i < l.length; i++) {
            var s = l[i];
            s.ref.impl = s.nextImpl;
          }
        mn(t, e, n), hn(e), u & 4 && (Ea(3, e, e.return), tr(3, e), Ea(5, e, e.return));
        break;
      case 1:
        mn(t, e, n), hn(e), u & 512 && (it || l === null || en(l, l.return)), u & 64 && Kt && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
        break;
      case 26:
        if (i = ol, mn(t, e, n), hn(e), u & 512 && (it || l === null || en(l, l.return)), u & 4)
          if (u = l !== null ? l.memoizedState : null, n = e.memoizedState, l === null)
            if (n === null)
              if (e.stateNode === null)
                if (Kt)
                  e.stateNode = ym(
                    e.type,
                    e.memoizedProps,
                    t.containerInfo,
                    e
                  );
                else {
                  e: {
                    t = e.type, n = e.memoizedProps, u = i.ownerDocument || i;
                    t: switch (t) {
                      case "title":
                        l = u.getElementsByTagName("title")[0], (!l || l[Ga] || l[Tt] || l.namespaceURI === "http://www.w3.org/2000/svg" || l.hasAttribute("itemprop")) && (l = u.createElement(t), u.head.insertBefore(
                          l,
                          u.querySelector("head > title")
                        )), tn(l, t, n), l[Tt] = e, ee(l), t = l;
                        break e;
                      case "link":
                        if (i = Gm(
                          "link",
                          "href",
                          u
                        ).get(t + (n.href || ""))) {
                          for (s = 0; s < i.length; s++)
                            if (l = i[s], l.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && l.getAttribute("rel") === (n.rel == null ? null : n.rel) && l.getAttribute("title") === (n.title == null ? null : n.title) && l.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
                              i.splice(s, 1);
                              break t;
                            }
                        }
                        l = u.createElement(t), tn(l, t, n), u.head.appendChild(l);
                        break;
                      case "meta":
                        if (i = Gm(
                          "meta",
                          "content",
                          u
                        ).get(t + (n.content || ""))) {
                          for (s = 0; s < i.length; s++)
                            if (l = i[s], l.getAttribute("content") === (n.content == null ? null : "" + n.content) && l.getAttribute("name") === (n.name == null ? null : n.name) && l.getAttribute("property") === (n.property == null ? null : n.property) && l.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && l.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
                              i.splice(s, 1);
                              break t;
                            }
                        }
                        l = u.createElement(t), tn(l, t, n), u.head.appendChild(l);
                        break;
                      default:
                        throw Error(c(468, t));
                    }
                    l[Tt] = e, ee(l), t = l;
                  }
                  e.stateNode = t;
                }
              else
                Kt || kf(i, e.type, e.stateNode);
            else
              e.stateNode = Ym(
                i,
                n,
                e.memoizedProps
              );
          else
            u !== n ? (u === null ? (t = l.stateNode, t === null || it || t.parentNode.removeChild(t)) : u.count--, n === null ? Kt || kf(i, e.type, e.stateNode) : Ym(i, n, e.memoizedProps)) : n === null && e.stateNode !== null && Ws(
              e,
              e.memoizedProps,
              l.memoizedProps
            );
        break;
      case 27:
        mn(t, e, n), hn(e), u & 512 && (it || l === null || en(l, l.return)), l !== null && u & 4 && Ws(
          e,
          e.memoizedProps,
          l.memoizedProps
        );
        break;
      case 5:
        if (i = El, El = !1, mn(t, e, n), El = i, hn(e), u & 512 && (it || l === null || en(l, l.return)), e.flags & 32) {
          t = e.stateNode;
          try {
            fn(t, ""), Ne = !0;
          } catch (X) {
            ct(e, e.return, X);
          }
        }
        u & 4 && e.stateNode != null && (t = e.memoizedProps, Ws(
          e,
          t,
          l !== null ? l.memoizedProps : t
        )), u & 1024 && (rf = !0);
        break;
      case 6:
        if (mn(t, e, n), hn(e), u & 4) {
          if (e.stateNode === null)
            throw Error(c(162));
          t = e.memoizedProps, n = e.stateNode;
          try {
            n.nodeValue = t, Ne = !0;
          } catch (X) {
            ct(e, e.return, X);
          }
        }
        break;
      case 3:
        if (Ne = !1, Jo = null, i = ol, ol = dr(t.containerInfo), mn(t, e, n), ol = i, hn(e), u & 4 && l !== null && l.memoizedState.isDehydrated)
          try {
            gi(t.containerInfo);
          } catch (X) {
            ct(e, e.return, X);
          }
        rf && (rf = !1, Hg(e)), Ne = !1;
        break;
      case 4:
        u = El, El = Kt, l = Vt(), i = ol, ol = dr(
          e.stateNode.containerInfo
        ), mn(t, e, n), hn(e), ol = i, Ne && lr && (_o = !0), Ne = l, El = u;
        break;
      case 12:
        mn(t, e, n), hn(e);
        break;
      case 31:
        mn(t, e, n), hn(e), u & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, jo(e, t)));
        break;
      case 13:
        mn(t, e, n), hn(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Bo = Zt()), u & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, jo(e, t)));
        break;
      case 22:
        i = e.memoizedState !== null, s = l !== null && l.memoizedState !== null;
        var v = Kt, T = it, w = El;
        Kt = v || i, El = w || i, it = T || s, mn(t, e, n), it = T, El = w, Kt = v, hn(e), u & 8192 && (t = e.stateNode, t._visibility = i ? t._visibility & -2 : t._visibility | 1, !i || l === null || s || Kt || it || (t = s || it, n = Kt, l = it, Kt = i || Kt, it = t, Ta(e, 2), Kt = n, it = l), !i && El || cf(e, i)), u & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, jo(e, n))));
        break;
      case 19:
        mn(t, e, n), hn(e), u & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, jo(e, t)));
        break;
      case 30:
        u & 512 && (it || l === null || en(l, l.return)), u = Vt(), i = lr, s = (n & 335544064) === n, v = e.memoizedProps, lr = s && Bl(
          v.default,
          v.update
        ) !== "none", mn(t, e, n), hn(e), s && l !== null && Ne && (e.flags |= 4), lr = i, Ne = u;
        break;
      case 21:
        break;
      case 7:
        u & 512 && (it || l === null || en(l, l.return)), l && l.stateNode !== null && (l.stateNode._fragmentFiber = e);
      default:
        mn(t, e, n), hn(e);
    }
  }
  function hn(e) {
    var t = e.flags;
    if (t & 2) {
      try {
        for (var n, l = e.return; l !== null; ) {
          if (Sg(l)) {
            n = l;
            break;
          }
          l = l.return;
        }
        l = null;
        for (var u = e.return; u !== null; ) {
          if (Fs(u)) {
            var i = u.stateNode;
            l === null ? l = [i] : l.push(i);
          }
          if (Js(u)) break;
          u = u.return;
        }
        var s = l;
        if (n == null) throw Error(c(160));
        switch (n.tag) {
          case 27:
            var v = n.stateNode, T = $s(e);
            No(
              e,
              T,
              v,
              s
            );
            break;
          case 5:
            var w = n.stateNode;
            n.flags & 32 && (fn(w, ""), n.flags &= -33);
            var X = $s(e);
            No(
              e,
              X,
              w,
              s
            );
            break;
          case 3:
          case 4:
            var J = n.stateNode.containerInfo, z = $s(e);
            ef(
              e,
              z,
              J,
              s
            );
            break;
          default:
            throw Error(c(161));
        }
      } catch (B) {
        ct(e, e.return, B);
      }
      e.flags &= -3;
    }
    t & 4096 && (e.flags &= -4097);
  }
  function Hg(e) {
    if (e.subtreeFlags & 1024)
      for (e = e.child; e !== null; ) {
        var t = e;
        Hg(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, vi = !0, t.reset(), vi = !1), e = e.sibling;
      }
  }
  function Fu(e, t) {
    if (t.subtreeFlags & 9270)
      for (t = t.child; t !== null; )
        Bg(t, e), t = t.sibling;
    else Og(t);
  }
  function Bg(e, t) {
    var n = e.alternate;
    if (n === null) tf(e, !1);
    else
      switch (e.tag) {
        case 3:
          if (of = Tl = !1, xg(), Fu(t, e), !Tl && !_o) {
            if (e = bl, e !== null)
              for (var l = 0; l < e.length; l += 3) {
                n = e[l];
                var u = e[l + 1];
                Cm(n, e[l + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate(
                  { opacity: [0, 0], pointerEvents: ["none", "none"] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition-group(" + u + ")"
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
            )), of = !0;
          }
          bl = null;
          break;
        case 5:
          Fu(t, e);
          break;
        case 4:
          l = Tl, Tl = !1, Fu(t, e), Tl && (_o = !0), Tl = l;
          break;
        case 22:
          e.memoizedState === null && (n.memoizedState !== null ? tf(e, !1) : Fu(t, e));
          break;
        case 30:
          l = Tl, u = xg(), Tl = !1, Fu(t, e), Tl && (e.flags |= 4);
          var i = e.memoizedProps, s = e.stateNode;
          t = Hl(i, s), s = Hl(n.memoizedProps, s);
          var v = Bl(i.default, i.update);
          v === "none" ? t = !1 : (i = n.memoizedState, n.memoizedState = null, n = e.child, En = 0, t = uf(
            e,
            n,
            t,
            s,
            v,
            i,
            !0
          ), En !== (i === null ? 0 : i.length) && (e.flags |= 32)), (e.flags & 4) !== 0 && t ? (li(
            e,
            e.memoizedProps.onUpdate
          ), bl = u) : u !== null && (u.push.apply(u, bl), bl = u), Tl = (e.flags & 32) !== 0 ? !0 : l;
          break;
        default:
          Fu(t, e);
      }
  }
  function xl(e, t) {
    if (t.subtreeFlags & 8772)
      for (t = t.child; t !== null; )
        zg(e, t.alternate, t), t = t.sibling;
  }
  function Ta(e, t) {
    for (e = e.child; e !== null; ) {
      var n = e, l = t;
      switch (n.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          Ea(4, n, n.return), Ta(
            n,
            l
          );
          break;
        case 1:
          en(n, n.return);
          var u = n.stateNode;
          typeof u.componentWillUnmount == "function" && yg(
            n,
            n.return,
            u
          ), Ta(
            n,
            l
          );
          break;
        case 27:
          (l & 2) !== 0 && Hm(
            n.stateNode,
            n.type,
            n.memoizedProps
          );
        case 5:
          en(n, n.return), n.tag !== 5 && n.tag !== 27 || nr(n), Ta(
            n,
            l
          );
          break;
        case 6:
          nr(n);
          break;
        case 26:
          en(n, n.return), u = n.stateNode, n.memoizedState !== null || u === null || it || u.parentNode.removeChild(u), Ta(
            n,
            l
          );
          break;
        case 22:
          n.memoizedState === null && Ta(
            n,
            l
          );
          break;
        case 30:
          en(n, n.return), Ta(
            n,
            l
          );
          break;
        case 7:
          en(n, n.return);
        default:
          Ta(
            n,
            l
          );
      }
      e = e.sibling;
    }
  }
  function cl(e, t, n) {
    for (n = (t.subtreeFlags & 8772) !== 0 ? n : n & -2, t = t.child; t !== null; ) {
      var l = t.alternate, u = e, i = t, s = i.flags, v = (n & 1) !== 0;
      switch (i.tag) {
        case 0:
        case 11:
        case 15:
          cl(
            u,
            i,
            n
          ), tr(4, i);
          break;
        case 1:
          if (cl(
            u,
            i,
            n
          ), l = i, u = l.stateNode, typeof u.componentDidMount == "function")
            try {
              u.componentDidMount();
            } catch (X) {
              ct(l, l.return, X);
            }
          if (l = i, u = l.updateQueue, u !== null) {
            var T = l.stateNode;
            try {
              var w = u.shared.hiddenCallbacks;
              if (w !== null)
                for (u.shared.hiddenCallbacks = null, u = 0; u < w.length; u++)
                  uv(w[u], T);
            } catch (X) {
              ct(l, l.return, X);
            }
          }
          v && s & 64 && pg(i), yl(i, i.return);
          break;
        case 27:
          (n & 2) !== 0 && Eg(i);
        case 5:
          i.tag !== 5 && i.tag !== 27 || bg(i), cl(
            u,
            i,
            n
          ), v && l === null && s & 4 && Ps(i), yl(i, i.return);
          break;
        case 6:
          bg(i);
          break;
        case 26:
          T = i.stateNode, i.memoizedState !== null || T === null || Kt || kf(
            dr(T.ownerDocument),
            i.type,
            T
          ), cl(
            u,
            i,
            n
          ), v && l === null && s & 4 && Ps(i), yl(i, i.return);
          break;
        case 12:
          cl(
            u,
            i,
            n
          );
          break;
        case 31:
          cl(
            u,
            i,
            n
          ), v && s & 4 && wg(u, i);
          break;
        case 13:
          cl(
            u,
            i,
            n
          ), v && s & 4 && jg(u, i);
          break;
        case 22:
          i.memoizedState === null && cl(
            u,
            i,
            n
          ), yl(i, i.return);
          break;
        case 30:
          cl(
            u,
            i,
            n
          ), yl(i, i.return);
          break;
        case 7:
          yl(i, i.return);
        default:
          cl(
            u,
            i,
            n
          );
      }
      t = t.sibling;
    }
  }
  function ff(e, t) {
    var n = null;
    e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Gi(n));
  }
  function df(e, t) {
    e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Gi(e));
  }
  function kn(e, t, n, l) {
    var u = (n & 335544064) === n;
    if (t.subtreeFlags & (u ? 10262 : 10256))
      for (t = t.child; t !== null; )
        Lg(
          e,
          t,
          n,
          l
        ), t = t.sibling;
    else u && Ag(t);
  }
  function Lg(e, t, n, l) {
    var u = (n & 335544064) === n;
    u && t.alternate === null && t.return !== null && t.return.alternate !== null && Do(t);
    var i = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        kn(
          e,
          t,
          n,
          l
        ), i & 2048 && tr(9, t);
        break;
      case 1:
        kn(
          e,
          t,
          n,
          l
        );
        break;
      case 3:
        kn(
          e,
          t,
          n,
          l
        ), u && of && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), i & 2048 && (i = null, t.alternate !== null && (i = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== i && (t.refCount++, i != null && Gi(i)));
        break;
      case 12:
        if (i & 2048) {
          kn(
            e,
            t,
            n,
            l
          ), i = t.stateNode;
          try {
            var s = t.memoizedProps, v = s.id, T = s.onPostCommit;
            typeof T == "function" && T(
              v,
              t.alternate === null ? "mount" : "update",
              i.passiveEffectDuration,
              -0
            );
          } catch (w) {
            ct(t, t.return, w);
          }
        } else
          kn(
            e,
            t,
            n,
            l
          );
        break;
      case 31:
        kn(
          e,
          t,
          n,
          l
        );
        break;
      case 13:
        kn(
          e,
          t,
          n,
          l
        );
        break;
      case 23:
        break;
      case 22:
        s = t.stateNode, v = t.alternate, t.memoizedState !== null ? (u && v !== null && v.memoizedState === null && Do(v), s._visibility & 2 ? kn(
          e,
          t,
          n,
          l
        ) : ar(
          e,
          t
        )) : (u && v !== null && v.memoizedState !== null && Do(t), s._visibility & 2 ? kn(
          e,
          t,
          n,
          l
        ) : (s._visibility |= 2, Pu(
          e,
          t,
          n,
          l,
          (t.subtreeFlags & 10256) !== 0 || !1
        ))), i & 2048 && ff(v, t);
        break;
      case 24:
        kn(
          e,
          t,
          n,
          l
        ), i & 2048 && df(t.alternate, t);
        break;
      case 30:
        u && (i = t.alternate, i !== null && (Sl(i.child, !0), Sl(t.child, !0))), kn(
          e,
          t,
          n,
          l
        );
        break;
      default:
        kn(
          e,
          t,
          n,
          l
        );
    }
  }
  function Pu(e, t, n, l, u) {
    for (u = u && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
      var i = e, s = t, v = n, T = l, w = s.flags;
      switch (s.tag) {
        case 0:
        case 11:
        case 15:
          Pu(
            i,
            s,
            v,
            T,
            u
          ), tr(8, s);
          break;
        case 23:
          break;
        case 22:
          var X = s.stateNode;
          s.memoizedState !== null ? X._visibility & 2 ? Pu(
            i,
            s,
            v,
            T,
            u
          ) : ar(
            i,
            s
          ) : (X._visibility |= 2, Pu(
            i,
            s,
            v,
            T,
            u
          )), u && w & 2048 && ff(
            s.alternate,
            s
          );
          break;
        case 24:
          Pu(
            i,
            s,
            v,
            T,
            u
          ), u && w & 2048 && df(s.alternate, s);
          break;
        default:
          Pu(
            i,
            s,
            v,
            T,
            u
          );
      }
      t = t.sibling;
    }
  }
  function ar(e, t) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) {
        var n = e, l = t, u = l.flags;
        switch (l.tag) {
          case 22:
            ar(n, l), u & 2048 && ff(
              l.alternate,
              l
            );
            break;
          case 24:
            ar(n, l), u & 2048 && df(l.alternate, l);
            break;
          default:
            ar(n, l);
        }
        t = t.sibling;
      }
  }
  var su = 8192;
  function fu(e, t, n) {
    if (e.subtreeFlags & su)
      for (e = e.child; e !== null; )
        Vg(
          e,
          t,
          n
        ), e = e.sibling;
  }
  function Vg(e, t, n) {
    switch (e.tag) {
      case 26:
        fu(
          e,
          t,
          n
        ), e.flags & su && (e.memoizedState !== null ? l1(
          n,
          ol,
          e.memoizedState,
          e.memoizedProps
        ) : (e = e.stateNode, (t & 335544128) === t && Im(n, e)));
        break;
      case 5:
        fu(
          e,
          t,
          n
        ), e.flags & su && (e = e.stateNode, (t & 335544128) === t && Im(n, e));
        break;
      case 3:
      case 4:
        var l = ol;
        ol = dr(e.stateNode.containerInfo), fu(
          e,
          t,
          n
        ), ol = l;
        break;
      case 22:
        e.memoizedState === null && (l = e.alternate, l !== null && l.memoizedState !== null ? (l = su, su = 16777216, fu(
          e,
          t,
          n
        ), su = l) : fu(
          e,
          t,
          n
        ));
        break;
      case 30:
        if ((e.flags & su) !== 0 && (l = e.memoizedProps.name, l != null && l !== "auto")) {
          var u = e.stateNode;
          u.paired = null, wn === null && (wn = /* @__PURE__ */ new Map()), wn.set(l, u);
        }
        fu(
          e,
          t,
          n
        );
        break;
      default:
        fu(
          e,
          t,
          n
        );
    }
  }
  function qg(e) {
    var t = e.alternate;
    if (t !== null && (e = t.child, e !== null)) {
      t.child = null;
      do
        t = e.sibling, e.sibling = null, e = t;
      while (e !== null);
    }
  }
  function ur(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var n = 0; n < t.length; n++) {
          var l = t[n];
          It = l, Gg(
            l,
            e
          );
        }
      qg(e);
    }
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; )
        Yg(e), e = e.sibling;
  }
  function Yg(e) {
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        ur(e), e.flags & 2048 && Ea(9, e, e.return);
        break;
      case 3:
        ur(e);
        break;
      case 12:
        ur(e);
        break;
      case 22:
        var t = e.stateNode;
        e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Uo(e)) : ur(e);
        break;
      default:
        ur(e);
    }
  }
  function Uo(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var n = 0; n < t.length; n++) {
          var l = t[n];
          It = l, Gg(
            l,
            e
          );
        }
      qg(e);
    }
    for (e = e.child; e !== null; ) {
      switch (t = e, t.tag) {
        case 0:
        case 11:
        case 15:
          Ea(8, t, t.return), Uo(t);
          break;
        case 22:
          n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Uo(t));
          break;
        default:
          Uo(t);
      }
      e = e.sibling;
    }
  }
  function Gg(e, t) {
    for (; It !== null; ) {
      var n = It;
      switch (n.tag) {
        case 0:
        case 11:
        case 15:
          Ea(8, n, t);
          break;
        case 23:
        case 22:
          if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
            var l = n.memoizedState.cachePool.pool;
            l != null && l.refCount++;
          }
          break;
        case 24:
          Gi(n.memoizedState.cache);
      }
      if (l = n.child, l !== null) l.return = n, It = l;
      else
        e: for (n = e; It !== null; ) {
          l = It;
          var u = l.sibling, i = l.return;
          if (Dg(l), l === n) {
            It = null;
            break e;
          }
          if (u !== null) {
            u.return = i, It = u;
            break e;
          }
          It = i;
        }
    }
  }
  var Wy = {
    getCacheForType: function(e) {
      var t = Pt(Ut), n = t.data.get(e);
      return n === void 0 && (n = e(), t.data.set(e, n)), n;
    },
    cacheSignal: function() {
      return Pt(Ut).controller.signal;
    }
  }, $y = typeof WeakMap == "function" ? WeakMap : Map, lt = 0, gt = null, Ze = null, Fe = 0, ot = 0, jn = null, xa = !1, Wu = !1, vf = !1, Il = 0, Ot = 0, Ca = 0, du = 0, Ho = 0, Un = 0, $u = 0, ir = null, xn = null, gf = !1, Bo = 0, Xg = 0, Lo = 1 / 0, Vo = null, Ra = null, Ct = 0, sl = null, vu = null, Cl = 0, mf = 0, hf = null, Qg = null, ei = null, ti = null, ni = null, rr = 0, qo = null;
  function Hn() {
    return (lt & 2) !== 0 && Fe !== 0 ? Fe & -Fe : se.T !== null ? Af() : Yn();
  }
  function Kg() {
    if (Un === 0)
      if ((Fe & 536870912) === 0 || Ke) {
        var e = ml;
        ml <<= 1, (ml & 3932160) === 0 && (ml = 262144), Un = e;
      } else Un = 536870912;
    return e = Wt.current, e !== null && (e.flags |= 32), Un;
  }
  function li(e, t) {
    if (t != null) {
      var n = e.stateNode, l = n.ref;
      l === null && (l = n.ref = Rm(
        Hl(e.memoizedProps, n)
      )), ti === null && (ti = []), ti.push(t.bind(null, l));
    }
  }
  function Cn(e, t, n) {
    (e === gt && (ot === 2 || ot === 9) || e.cancelPendingCommit !== null) && (ai(e, 0), Aa(
      e,
      Fe,
      Un,
      !1
    )), wl(e, n), ((lt & 2) === 0 || e !== gt) && (e === gt && ((lt & 2) === 0 && (du |= n), Ot === 4 && Aa(
      e,
      Fe,
      Un,
      !1
    )), Rl(e));
  }
  function Ig(e, t, n) {
    if ((lt & 6) !== 0) throw Error(c(327));
    var l = !n && (t & 127) === 0 && (t & e.expiredLanes) === 0 || nl(e, t), u = l ? nb(e, t) : yf(e, t, !0), i = l;
    do {
      if (u === 0) {
        Wu && !l && Aa(e, t, 0, !1);
        break;
      } else {
        if (n = e.current.alternate, i && !eb(n)) {
          u = yf(e, t, !1), i = !1;
          continue;
        }
        if (u === 2) {
          if (i = t, e.errorRecoveryDisabledLanes & i)
            var s = 0;
          else
            s = e.pendingLanes & -536870913, s = s !== 0 ? s : s & 536870912 ? 536870912 : 0;
          if (s !== 0) {
            t = s;
            e: {
              var v = e;
              u = ir;
              var T = v.current.memoizedState.isDehydrated;
              if (T && (ai(v, s).flags |= 256), s = yf(
                v,
                s,
                !1
              ), s !== 2 && s !== 6) {
                if (vf && !T) {
                  v.errorRecoveryDisabledLanes |= i, du |= i, u = 4;
                  break e;
                }
                i = xn, xn = u, i !== null && (xn === null ? xn = i : xn.push.apply(
                  xn,
                  i
                ));
              }
              u = s;
            }
            if (i = !1, u !== 2) continue;
          }
        }
        if (u === 1) {
          ai(e, 0), Aa(e, t, 0, !0);
          break;
        }
        e: {
          switch (l = e, i = u, i) {
            case 0:
            case 1:
              throw Error(c(345));
            case 4:
              if ((t & 4194048) !== t && (t & 62914560) !== t)
                break;
            case 6:
              Aa(
                l,
                t,
                Un,
                !xa
              );
              break e;
            case 2:
              xn = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(c(329));
          }
          if ((t & 62914560) === t && (u = Bo + 300 - Zt(), 10 < u)) {
            if (Aa(
              l,
              t,
              Un,
              !xa
            ), tl(l, 0, !0) !== 0) break e;
            Cl = t, l.timeoutHandle = Bf(
              Zg.bind(
                null,
                l,
                n,
                xn,
                Vo,
                gf,
                t,
                Un,
                du,
                $u,
                xa,
                i,
                "Throttled",
                -0,
                0
              ),
              u
            );
            break e;
          }
          Zg(
            l,
            n,
            xn,
            Vo,
            gf,
            t,
            Un,
            du,
            $u,
            xa,
            i,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    Rl(e);
  }
  function Zg(e, t, n, l, u, i, s, v, T, w, X, J, z, B) {
    e.timeoutHandle = -1;
    var de = t.subtreeFlags, Ee = (i & 335544064) === i;
    if (J = null, (Ee || de & 8192 || (de & 16785408) === 16785408) && (J = {
      stylesheets: null,
      count: 0,
      imgCount: 0,
      imgBytes: 0,
      suspenseyImages: [],
      waitingForImages: !0,
      waitingForViewTransition: !1,
      unsuspend: dn
    }, wn = null, Vg(
      t,
      i,
      J
    ), Ee && (de = J, Ee = e.containerInfo, Ee = (Ee.nodeType === 9 ? Ee : Ee.ownerDocument).__reactViewTransition, Ee != null && (de.count++, de.waitingForViewTransition = !0, de = mr.bind(de), Ee.finished.then(de, de))), de = (i & 62914560) === i ? Bo - Zt() : (i & 4194048) === i ? Xg - Zt() : 0, de = a1(
      J,
      de
    ), de !== null)) {
      Cl = i, e.cancelPendingCommit = de(
        tm.bind(
          null,
          e,
          t,
          i,
          n,
          l,
          u,
          s,
          v,
          T,
          w,
          X,
          J,
          null,
          z,
          B
        )
      ), Aa(e, i, s, !w);
      return;
    }
    tm(
      e,
      t,
      i,
      n,
      l,
      u,
      s,
      v,
      T,
      w,
      X,
      J
    );
  }
  function eb(e) {
    for (var t = e; ; ) {
      var n = t.tag;
      if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null)))
        for (var l = 0; l < n.length; l++) {
          var u = n[l], i = u.getSnapshot;
          u = u.value;
          try {
            if (!Dn(i(), u)) return !1;
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
  function Aa(e, t, n, l) {
    t = la(e, t), t &= ~Ho, t &= ~du, e.suspendedLanes |= t, e.pingedLanes &= ~t, l && (e.warmLanes |= t), l = e.expirationTimes;
    for (var u = t; 0 < u; ) {
      var i = 31 - Gt(u), s = 1 << i;
      l[i] = -1, u &= ~s;
    }
    n !== 0 && al(e, n, t);
  }
  function Yo() {
    return (lt & 6) === 0 ? (or(0), !1) : !0;
  }
  function pf() {
    if (Ze !== null) {
      if (ot === 0)
        var e = Ze.return;
      else
        e = Ze, ql = eu = null, Cs(e), Qu = null, Ki = 0, e = Ze;
      for (; e !== null; )
        hg(e.alternate, e), e = e.return;
      Ze = null;
    }
  }
  function ai(e, t) {
    var n = e.timeoutHandle;
    return n !== -1 && (e.timeoutHandle = -1, Cb(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Cl = 0, pf(), gt = e, Ze = n = Ll(e.current, null), Fe = t, ot = 0, jn = null, xa = !1, Wu = nl(e, t), vf = !1, $u = Un = Ho = du = Ca = Ot = 0, xn = ir = null, gf = !1, Il = la(e, t), kr(), n;
  }
  function kg(e, t) {
    Ye = null, se.H = So, t === Xu || t === uo ? (t = tv(), ot = 3) : t === fs ? (t = tv(), ot = 4) : ot = t === Vs ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, jn = t, Ze === null && (Ot = 1, Eo(
      e,
      Qn(t, e.current)
    ));
  }
  function Jg() {
    var e = Wt.current;
    return e === null ? !0 : (Fe & 4194048) === Fe ? on === null : (Fe & 62914560) === Fe || (Fe & 536870912) !== 0 ? e === on : !1;
  }
  function Fg() {
    var e = se.H;
    return se.H = So, e === null ? So : e;
  }
  function Pg() {
    var e = se.A;
    return se.A = Wy, e;
  }
  function Go() {
    Ot = 4, xa || (Fe & 4194048) !== Fe && Wt.current !== null || (Wu = !0), (Ca & 134217727) === 0 && (du & 134217727) === 0 || gt === null || Aa(
      gt,
      Fe,
      Un,
      !1
    );
  }
  function yf(e, t, n) {
    var l = lt;
    lt |= 2;
    var u = Fg(), i = Pg();
    (gt !== e || Fe !== t) && (Vo = null, ai(e, t)), t = !1;
    var s = Ot;
    e: do
      try {
        if (ot !== 0 && Ze !== null) {
          var v = Ze, T = jn;
          switch (ot) {
            case 8:
              pf(), s = 6;
              break e;
            case 3:
            case 2:
            case 9:
            case 6:
              Wt.current === null && (t = !0);
              var w = ot;
              if (ot = 0, jn = null, ui(e, v, T, w), n && Wu) {
                s = 0;
                break e;
              }
              break;
            default:
              w = ot, ot = 0, jn = null, ui(e, v, T, w);
          }
        }
        tb(), s = Ot;
        break;
      } catch (X) {
        kg(e, X);
      }
    while (!0);
    return t && e.shellSuspendCounter++, ql = eu = null, lt = l, se.H = u, se.A = i, Ze === null && (gt = null, Fe = 0, kr()), s;
  }
  function tb() {
    for (; Ze !== null; ) Wg(Ze);
  }
  function nb(e, t) {
    var n = lt;
    lt |= 2;
    var l = Fg(), u = Pg();
    gt !== e || Fe !== t ? (Vo = null, Lo = Zt() + 500, ai(e, t)) : Wu = nl(
      e,
      t
    );
    e: do
      try {
        if (ot !== 0 && Ze !== null) {
          t = Ze;
          var i = jn;
          t: switch (ot) {
            case 1:
              ot = 0, jn = null, ui(e, t, i, 1);
              break;
            case 2:
            case 9:
              if ($0(i)) {
                ot = 0, jn = null, $g(t);
                break;
              }
              t = function() {
                ot !== 2 && ot !== 9 || gt !== e || (ot = 7), Rl(e);
              }, i.then(t, t);
              break e;
            case 3:
              ot = 7;
              break e;
            case 4:
              ot = 5;
              break e;
            case 7:
              $0(i) ? (ot = 0, jn = null, $g(t)) : (ot = 0, jn = null, ui(e, t, i, 7));
              break;
            case 5:
              var s = null;
              switch (Ze.tag) {
                case 26:
                  s = Ze.memoizedState;
                case 5:
                case 27:
                  var v = Ze;
                  if (s ? Qm(s) : v.stateNode.complete) {
                    ot = 0, jn = null;
                    var T = v.sibling;
                    if (T !== null) Ze = T;
                    else {
                      var w = v.return;
                      w !== null ? (Ze = w, Xo(w)) : Ze = null;
                    }
                    break t;
                  }
              }
              ot = 0, jn = null, ui(e, t, i, 5);
              break;
            case 6:
              ot = 0, jn = null, ui(e, t, i, 6);
              break;
            case 8:
              pf(), Ot = 6;
              break e;
            default:
              throw Error(c(462));
          }
        }
        lb();
        break;
      } catch (X) {
        kg(e, X);
      }
    while (!0);
    return ql = eu = null, se.H = l, se.A = u, lt = n, Ze !== null ? 0 : (gt = null, Fe = 0, kr(), Ot);
  }
  function lb() {
    for (; Ze !== null && !Wl(); )
      Wg(Ze);
  }
  function Wg(e) {
    var t = gg(e.alternate, e, Il);
    e.memoizedProps = e.pendingProps, t === null ? Xo(e) : Ze = t;
  }
  function $g(e) {
    var t = e, n = t.alternate;
    switch (t.tag) {
      case 15:
      case 0:
        t = rg(
          n,
          t,
          t.pendingProps,
          t.type,
          void 0,
          Fe
        );
        break;
      case 11:
        t = rg(
          n,
          t,
          t.pendingProps,
          t.type.render,
          t.ref,
          Fe
        );
        break;
      case 5:
        Cs(t);
        var l = t;
        l === Qt && (Ke ? (eo(l), l.tag === 5 && l.stateNode != null && (ht = l.stateNode)) : (eo(l), Ke = !0));
      default:
        hg(n, t), t = Ze = G0(t, Il), t = gg(n, t, Il);
    }
    e.memoizedProps = e.pendingProps, t === null ? Xo(e) : Ze = t;
  }
  function ui(e, t, n, l) {
    ql = eu = null, Cs(t), Qu = null, Ki = 0;
    var u = t.return;
    try {
      if (Qy(
        e,
        u,
        t,
        n,
        Fe
      )) {
        Ot = 1, Eo(
          e,
          Qn(n, e.current)
        ), Ze = null;
        return;
      }
    } catch (i) {
      if (u !== null) throw Ze = u, i;
      Ot = 1, Eo(
        e,
        Qn(n, e.current)
      ), Ze = null;
      return;
    }
    t.flags & 32768 ? (Ke || l === 1 ? e = !0 : Wu || (Fe & 536870912) !== 0 ? e = !1 : (xa = e = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = Wt.current, l !== null && l.tag === 13 && (l.flags |= 16384))), em(t, e)) : Xo(t);
  }
  function Xo(e) {
    var t = e;
    do {
      if ((t.flags & 32768) !== 0) {
        em(
          t,
          xa
        );
        return;
      }
      e = t.return;
      var n = ky(
        t.alternate,
        t,
        Il
      );
      if (n !== null) {
        Ze = n;
        return;
      }
      if (t = t.sibling, t !== null) {
        Ze = t;
        return;
      }
      Ze = t = e;
    } while (t !== null);
    Ot === 0 && (Ot = 5);
  }
  function em(e, t) {
    do {
      var n = Jy(e.alternate, e);
      if (n !== null) {
        n.flags &= 32767, Ze = n;
        return;
      }
      if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
        Ze = e;
        return;
      }
      Ze = e = n;
    } while (e !== null);
    Ot = 6, Ze = null;
  }
  function tm(e, t, n, l, u, i, s, v, T, w, X, J) {
    e.cancelPendingCommit = null;
    do
      Qo();
    while (Ct !== 0);
    if ((lt & 6) !== 0) throw Error(c(327));
    if (t !== null) {
      if (t === e.current) throw Error(c(177));
      e === gt && (Ze = gt = null, Fe = 0), vu = t, sl = e, Cl = n, hf = u, Qg = l, ab(
        e,
        t,
        n,
        s,
        v,
        T,
        J
      );
    }
  }
  function ab(e, t, n, l, u, i, s) {
    var v = t.lanes | t.childLanes;
    if (mf = v, v |= Wc, Cu(
      e,
      n,
      v,
      l,
      u,
      i
    ), ti = null, (n & 335544064) === n ? (ni = _y(e), l = 10262) : (ni = null, l = 10256), (t.subtreeFlags & l) !== 0 || (t.flags & l) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, sb(yn, function() {
      return Tf(), null;
    })) : (e.callbackNode = null, e.callbackPriority = 0), zo = !1, l = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || l) {
      l = se.T, se.T = null, u = ve.p, ve.p = 2, i = lt, lt |= 4;
      try {
        Fy(e, t, n);
      } finally {
        lt = i, ve.p = u, se.T = l;
      }
    }
    Ct = 1, zo ? ei = Mb(
      s,
      e.containerInfo,
      ni,
      bf,
      Sf,
      ib,
      Ef,
      Tf,
      ub
    ) : (bf(), Sf(), Ef());
  }
  function ub(e) {
    if (Ct !== 0) {
      var t = sl.onRecoverableError;
      t(e, { componentStack: null });
    }
  }
  function ib() {
    Ct === 3 && (Ct = 0, Bg(vu, sl), Ct = 4);
  }
  function bf() {
    if (Ct === 1) {
      Ct = 0;
      var e = sl, t = vu, n = Cl, l = (t.flags & 13878) !== 0;
      if ((t.subtreeFlags & 13878) !== 0 || l) {
        l = se.T, se.T = null;
        var u = ve.p;
        ve.p = 2;
        var i = lt;
        lt |= 4;
        try {
          lr = _o = !1, Ug(t, e, n), n = jf;
          var s = _0(e.containerInfo), v = n.focusedElem, T = n.selectionRange;
          if (s !== v && v && v.ownerDocument && D0(
            v.ownerDocument.documentElement,
            v
          )) {
            if (T !== null && Zc(v)) {
              var w = T.start, X = T.end;
              if (X === void 0 && (X = w), "selectionStart" in v)
                v.selectionStart = w, v.selectionEnd = Math.min(
                  X,
                  v.value.length
                );
              else {
                var J = v.ownerDocument || document, z = J && J.defaultView || window;
                if (z.getSelection) {
                  var B = z.getSelection(), de = v.textContent.length, Ee = Math.min(T.start, de), Ge = T.end === void 0 ? Ee : Math.min(T.end, de);
                  !B.extend && Ee > Ge && (s = Ge, Ge = Ee, Ee = s);
                  var D = M0(
                    v,
                    Ee
                  ), C = M0(
                    v,
                    Ge
                  );
                  if (D && C && (B.rangeCount !== 1 || B.anchorNode !== D.node || B.anchorOffset !== D.offset || B.focusNode !== C.node || B.focusOffset !== C.offset)) {
                    var H = J.createRange();
                    H.setStart(D.node, D.offset), B.removeAllRanges(), Ee > Ge ? (B.addRange(H), B.extend(C.node, C.offset)) : (H.setEnd(C.node, C.offset), B.addRange(H));
                  }
                }
              }
            }
            for (J = [], B = v; B = B.parentNode; )
              B.nodeType === 1 && J.push({
                element: B,
                left: B.scrollLeft,
                top: B.scrollTop
              });
            for (typeof v.focus == "function" && v.focus(), v = 0; v < J.length; v++) {
              var k = J[v];
              k.element.scrollLeft = k.left, k.element.scrollTop = k.top;
            }
          }
          vi = !!wf, jf = wf = null;
        } finally {
          lt = i, ve.p = u, se.T = l;
        }
      }
      e.current = t, Ct = 2;
    }
  }
  function Sf() {
    if (Ct === 2) {
      Ct = 0;
      var e = sl, t = vu, n = (t.flags & 8772) !== 0;
      if ((t.subtreeFlags & 8772) !== 0 || n) {
        n = se.T, se.T = null;
        var l = ve.p;
        ve.p = 2;
        var u = lt;
        lt |= 4;
        try {
          zg(e, t.alternate, t);
        } finally {
          lt = u, ve.p = l, se.T = n;
        }
      }
      Ct = 3;
    }
  }
  function Ef() {
    if (Ct === 4 || Ct === 3) {
      Ct = 0;
      var e = ei;
      ei = null, Ci();
      var t = sl, n = vu, l = Cl, u = Qg, i = (l & 335544064) === l ? 10262 : 10256;
      if ((n.subtreeFlags & i) !== 0 || (n.flags & i) !== 0 ? Ct = 5 : (Ct = 0, vu = sl = null, nm(t, t.pendingLanes)), i = t.pendingLanes, i === 0 && (Ra = null), qn(l), n = n.stateNode, un && typeof un.onCommitFiberRoot == "function")
        try {
          un.onCommitFiberRoot(
            $l,
            n,
            void 0,
            (n.current.flags & 128) === 128
          );
        } catch {
        }
      if (u !== null) {
        n = se.T, i = ve.p, ve.p = 2, se.T = null;
        try {
          for (var s = t.onRecoverableError, v = 0; v < u.length; v++) {
            var T = u[v];
            s(T.value, {
              componentStack: T.stack
            });
          }
        } finally {
          se.T = n, ve.p = i;
        }
      }
      if (u = ti, s = ni, ni = null, u !== null && (ti = null, s === null && (s = []), e !== null))
        for (T = 0; T < u.length; T++)
          n = (0, u[T])(
            s
          ), n !== void 0 && e.finished.finally(n);
      (Cl & 3) !== 0 && Qo(), Rl(t), i = t.pendingLanes, (l & 261930) !== 0 && (i & 42) !== 0 ? t === qo ? rr++ : (rr = 0, qo = t) : (rr = 0, qo = null), or(0);
    }
  }
  function nm(e, t) {
    (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Gi(t)));
  }
  function Qo() {
    return ei !== null && (ei.skipTransition(), ei = null), bf(), Sf(), Ef(), Tf();
  }
  function Tf() {
    if (Ct !== 5) return !1;
    var e = sl, t = mf;
    mf = 0;
    var n = qn(Cl), l = se.T, u = ve.p;
    try {
      ve.p = 32 > n ? 32 : n, se.T = null, n = hf, hf = null;
      var i = sl, s = Cl;
      if (Ct = 0, vu = sl = null, Cl = 0, (lt & 6) !== 0) throw Error(c(331));
      var v = lt;
      if (lt |= 4, Yg(i.current), Lg(
        i,
        i.current,
        s,
        n
      ), lt = v, or(0, !1), un && typeof un.onPostCommitFiberRoot == "function")
        try {
          un.onPostCommitFiberRoot($l, i);
        } catch {
        }
      return !0;
    } finally {
      ve.p = u, se.T = l, nm(e, t);
    }
  }
  function lm(e, t, n) {
    t = Qn(n, t), t = Ls(e.stateNode, t, 2), e = pa(e, t, 2), e !== null && (wl(e, 2), Rl(e));
  }
  function ct(e, t, n) {
    if (e.tag === 3)
      lm(e, e, n);
    else
      for (; t !== null; ) {
        if (t.tag === 3) {
          lm(
            t,
            e,
            n
          );
          break;
        } else if (t.tag === 1) {
          var l = t.stateNode;
          if (typeof t.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ra === null || !Ra.has(l))) {
            e = Qn(n, e), n = $v(2), l = pa(t, n, 2), l !== null && (eg(
              n,
              l,
              t,
              e
            ), wl(l, 2), Rl(l));
            break;
          }
        }
        t = t.return;
      }
  }
  function xf(e, t, n) {
    var l = e.pingCache;
    if (l === null) {
      l = e.pingCache = new $y();
      var u = /* @__PURE__ */ new Set();
      l.set(t, u);
    } else
      u = l.get(t), u === void 0 && (u = /* @__PURE__ */ new Set(), l.set(t, u));
    u.has(n) || (vf = !0, u.add(n), e = rb.bind(null, e, t, n), t.then(e, e));
  }
  function rb(e, t, n) {
    var l = e.pingCache;
    l !== null && l.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, gt === e && (Fe & n) === n && ((Ot === 4 || Ot === 3 && (Fe & 62914560) === Fe && 300 > Zt() - Bo) && (lt & 2) === 0 ? ai(e, 0) : Ho |= n, $u === Fe && ($u = 0)), Rl(e);
  }
  function am(e, t) {
    t === 0 && (t = ll()), e = Pa(e, t), e !== null && (wl(e, t), Rl(e));
  }
  function ob(e) {
    var t = e.memoizedState, n = 0;
    t !== null && (n = t.retryLane), am(e, n);
  }
  function cb(e, t) {
    var n = 0;
    switch (e.tag) {
      case 31:
      case 13:
        var l = e.stateNode, u = e.memoizedState;
        u !== null && (n = u.retryLane);
        break;
      case 19:
        l = e.stateNode;
        break;
      case 22:
        l = e.stateNode._retryCache;
        break;
      default:
        throw Error(c(314));
    }
    l !== null && l.delete(t), am(e, n);
  }
  function sb(e, t) {
    return Va(e, t);
  }
  var ii = null, ri = null, Cf = !1, Ko = !1, Rf = !1, Oa = 0;
  function Rl(e) {
    e !== ri && e.next === null && (ri === null ? ii = ri = e : ri = ri.next = e), Ko = !0, Cf || (Cf = !0, db());
  }
  function or(e, t) {
    if (!Rf && Ko) {
      Rf = !0;
      do
        for (var n = !1, l = ii; l !== null; ) {
          if (e !== 0) {
            var u = l.pendingLanes;
            if (u === 0) var i = 0;
            else {
              var s = l.suspendedLanes, v = l.pingedLanes;
              i = (1 << 31 - Gt(42 | e) + 1) - 1, i &= u & ~(s & ~v), i = i & 201326741 ? i & 201326741 | 1 : i ? i | 2 : 0;
            }
            i !== 0 && (n = !0, om(l, i));
          } else
            i = Fe, i = tl(
              l,
              l === gt ? i : 0,
              l.cancelPendingCommit !== null || l.timeoutHandle !== -1
            ), (i & 3) === 0 || nl(l, i) || (n = !0, om(l, i));
          l = l.next;
        }
      while (n);
      Rf = !1;
    }
  }
  function fb() {
    um();
  }
  function um() {
    Ko = Cf = !1;
    var e = 0;
    Oa !== 0 && xb() && (e = Oa);
    for (var t = Zt(), n = null, l = ii; l !== null; ) {
      var u = l.next, i = im(l, t);
      i === 0 ? (l.next = null, n === null ? ii = u : n.next = u, u === null && (ri = n)) : (n = l, (e !== 0 || (i & 3) !== 0) && (Ko = !0)), l = u;
    }
    Ct !== 0 && Ct !== 5 || or(e), Oa !== 0 && (Oa = 0);
  }
  function im(e, t) {
    for (var n = e.suspendedLanes, l = e.pingedLanes, u = e.expirationTimes, i = e.pendingLanes & -62914561; 0 < i; ) {
      var s = 31 - Gt(i), v = 1 << s, T = u[s];
      T === -1 ? ((v & n) === 0 || (v & l) !== 0) && (u[s] = Ai(v, t)) : T <= t && (e.expiredLanes |= v), i &= ~v;
    }
    if (t = gt, n = Fe, n = tl(
      e,
      e === t ? n : 0,
      e.cancelPendingCommit !== null || e.timeoutHandle !== -1
    ), l = e.callbackNode, n === 0 || e === t && (ot === 2 || ot === 9) || e.cancelPendingCommit !== null)
      return l !== null && l !== null && Pl(l), e.callbackNode = null, e.callbackPriority = 0;
    if ((n & 3) === 0 || nl(e, n)) {
      if (t = n & -n, t === e.callbackPriority) return t;
      switch (l !== null && Pl(l), qn(n)) {
        case 2:
        case 8:
          n = Tu;
          break;
        case 32:
          n = yn;
          break;
        case 268435456:
          n = Ri;
          break;
        default:
          n = yn;
      }
      return l = rm.bind(null, e), n = Va(n, l), e.callbackPriority = t, e.callbackNode = n, t;
    }
    return l !== null && l !== null && Pl(l), e.callbackPriority = 2, e.callbackNode = null, 2;
  }
  function rm(e, t) {
    if (Ct !== 0 && Ct !== 5)
      return e.callbackNode = null, e.callbackPriority = 0, null;
    var n = e.callbackNode;
    if (Qo() && e.callbackNode !== n)
      return null;
    var l = Fe;
    return l = tl(
      e,
      e === gt ? l : 0,
      e.cancelPendingCommit !== null || e.timeoutHandle !== -1
    ), l === 0 ? null : (Ig(e, l, t), im(e, Zt()), e.callbackNode != null && e.callbackNode === n ? rm.bind(null, e) : null);
  }
  function om(e, t) {
    if (Qo()) return null;
    Ig(e, t, !0);
  }
  function db() {
    Rb(function() {
      (lt & 6) !== 0 ? Va(
        gl,
        fb
      ) : um();
    });
  }
  function Af() {
    if (Oa === 0) {
      var e = lu;
      e === 0 && (e = Dl, Dl <<= 1, (Dl & 261888) === 0 && (Dl = 256)), Oa = e;
    }
    return Oa;
  }
  function cm(e) {
    return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : Jt(e);
  }
  function vb(e, t, n, l, u) {
    if (t === "submit" && n && n.stateNode === u) {
      var i = cm(
        (u[kt] || null).action
      ), s = l.submitter;
      s && (t = (t = s[kt] || null) ? cm(t.formAction) : s.getAttribute("formAction"), t !== null && (i = t, s = null));
      var v = new Qr(
        "action",
        "action",
        null,
        l,
        u
      );
      e.push({
        event: v,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (l.defaultPrevented) {
                if (Oa !== 0) {
                  var T = new FormData(u, s);
                  ws(
                    n,
                    {
                      pending: !0,
                      data: T,
                      method: u.method,
                      action: i
                    },
                    null,
                    T
                  );
                }
              } else
                typeof i == "function" && (v.preventDefault(), T = new FormData(u, s), ws(
                  n,
                  {
                    pending: !0,
                    data: T,
                    method: u.method,
                    action: i
                  },
                  i,
                  T
                ));
            },
            currentTarget: u
          }
        ]
      });
    }
  }
  for (var Of = 0; Of < Pc.length; Of++) {
    var Nf = Pc[Of], gb = Nf.toLowerCase(), mb = Nf[0].toUpperCase() + Nf.slice(1);
    il(
      gb,
      "on" + mb
    );
  }
  il(U0, "onAnimationEnd"), il(H0, "onAnimationIteration"), il(B0, "onAnimationStart"), il("dblclick", "onDoubleClick"), il("focusin", "onFocus"), il("focusout", "onBlur"), il(Cy, "onTransitionRun"), il(Ry, "onTransitionStart"), il(Ay, "onTransitionCancel"), il(L0, "onTransitionEnd"), dt("onMouseEnter", ["mouseout", "mouseover"]), dt("onMouseLeave", ["mouseout", "mouseover"]), dt("onPointerEnter", ["pointerout", "pointerover"]), dt("onPointerLeave", ["pointerout", "pointerover"]), Qe(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), Qe(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), Qe("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), Qe(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), Qe(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), Qe(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var cr = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), hb = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(cr)
  );
  function sm(e, t) {
    t = (t & 4) !== 0;
    for (var n = 0; n < e.length; n++) {
      var l = e[n], u = l.event;
      l = l.listeners;
      e: {
        var i = void 0;
        if (t)
          for (var s = l.length - 1; 0 <= s; s--) {
            var v = l[s], T = v.instance, w = v.currentTarget;
            if (v = v.listener, T !== i && u.isPropagationStopped())
              break e;
            i = v, u.currentTarget = w;
            try {
              i(u);
            } catch (X) {
              Zr(X);
            }
            u.currentTarget = null, i = T;
          }
        else
          for (s = 0; s < l.length; s++) {
            if (v = l[s], T = v.instance, w = v.currentTarget, v = v.listener, T !== i && u.isPropagationStopped())
              break e;
            i = v, u.currentTarget = w;
            try {
              i(u);
            } catch (X) {
              Zr(X);
            }
            u.currentTarget = null, i = T;
          }
      }
    }
  }
  function ke(e, t) {
    var n = t[Oi];
    n === void 0 && (n = t[Oi] = /* @__PURE__ */ new Set());
    var l = e + "__bubble";
    n.has(l) || (fm(t, e, 2, !1), n.add(l));
  }
  function zf(e, t, n) {
    var l = 0;
    t && (l |= 4), fm(
      n,
      e,
      l,
      t
    );
  }
  var Io = "_reactListening" + Math.random().toString(36).slice(2);
  function Mf(e) {
    if (!e[Io]) {
      e[Io] = !0, Le.forEach(function(n) {
        n !== "selectionchange" && (hb.has(n) || zf(n, !1, e), zf(n, !0, e));
      });
      var t = e.nodeType === 9 ? e : e.ownerDocument;
      t === null || t[Io] || (t[Io] = !0, zf("selectionchange", !1, t));
    }
  }
  function fm(e, t, n, l) {
    switch (eh(t)) {
      case 2:
        var u = o1;
        break;
      case 8:
        u = c1;
        break;
      default:
        u = Ff;
    }
    n = u.bind(
      null,
      t,
      n,
      e
    ), u = void 0, !ka || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (u = !0), l ? u !== void 0 ? e.addEventListener(t, n, {
      capture: !0,
      passive: u
    }) : e.addEventListener(t, n, !0) : u !== void 0 ? e.addEventListener(t, n, {
      passive: u
    }) : e.addEventListener(t, n, !1);
  }
  function Df(e, t, n, l, u) {
    var i = l;
    if ((t & 1) === 0 && (t & 2) === 0 && l !== null)
      e: for (; ; ) {
        if (l === null) return;
        var s = l.tag;
        if (s === 3 || s === 4) {
          var v = l.stateNode.containerInfo;
          if (v === u) break;
          if (s === 4)
            for (s = l.return; s !== null; ) {
              var T = s.tag;
              if ((T === 3 || T === 4) && s.stateNode.containerInfo === u)
                return;
              s = s.return;
            }
          for (; v !== null; ) {
            if (s = ul(v), s === null) return;
            if (T = s.tag, T === 5 || T === 6 || T === 26 || T === 27) {
              l = i = s;
              continue e;
            }
            v = v.parentNode;
          }
        }
        l = l.return;
      }
    Za(function() {
      var w = i, X = Ia(n), J = [];
      e: {
        var z = V0.get(e);
        if (z !== void 0) {
          var B = Qr, de = e;
          switch (e) {
            case "keypress":
              if (Gr(n) === 0) break e;
            case "keydown":
            case "keyup":
              B = ey;
              break;
            case "focusin":
              de = "focus", B = Yc;
              break;
            case "focusout":
              de = "blur", B = Yc;
              break;
            case "beforeblur":
            case "afterblur":
              B = Yc;
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
              B = g0;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              B = Gp;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              B = uy;
              break;
            case U0:
            case H0:
            case B0:
              B = Kp;
              break;
            case L0:
              B = ry;
              break;
            case "scroll":
            case "scrollend":
              B = qp;
              break;
            case "wheel":
              B = cy;
              break;
            case "copy":
            case "cut":
            case "paste":
              B = Zp;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              B = h0;
              break;
            case "submit":
              B = ly;
              break;
            case "toggle":
            case "beforetoggle":
              B = fy;
          }
          var Ee = (t & 4) !== 0, Ge = !Ee && (e === "scroll" || e === "scrollend"), D = Ee ? z !== null ? z + "Capture" : null : z;
          Ee = [];
          for (var C = w, H; C !== null; ) {
            var k = C;
            if (H = k.stateNode, k = k.tag, k !== 5 && k !== 26 && k !== 27 || H === null || D === null || (k = Ul(C, D), k != null && Ee.push(
              sr(C, k, H)
            )), Ge) break;
            C = C.return;
          }
          0 < Ee.length && (z = new B(
            z,
            de,
            null,
            n,
            X
          ), J.push({ event: z, listeners: Ee }));
        }
      }
      if ((t & 7) === 0) {
        e: {
          if (B = e === "mouseover" || e === "pointerover", z = e === "mouseout" || e === "pointerout", B && n !== Ka && (de = n.relatedTarget || n.fromElement) && (ul(de) || de[An]))
            break e;
          (z || B) && (de = X.window === X ? X : (B = X.ownerDocument) ? B.defaultView || B.parentWindow : window, z ? (B = n.relatedTarget || n.toElement, z = w, B = B ? ul(B) : null, B !== null && (Ge = d(B), Ee = B.tag, B !== Ge || Ee !== 5 && Ee !== 27 && Ee !== 6) && (B = null)) : (z = null, B = w), z !== B && (Ee = g0, k = "onMouseLeave", D = "onMouseEnter", C = "mouse", (e === "pointerout" || e === "pointerover") && (Ee = h0, k = "onPointerLeave", D = "onPointerEnter", C = "pointer"), Ge = z == null ? de : G(z), H = B == null ? de : G(B), de = new Ee(
            k,
            C + "leave",
            z,
            n,
            X
          ), de.target = Ge, de.relatedTarget = H, k = null, ul(X) === w && (Ee = new Ee(
            D,
            C + "enter",
            B,
            n,
            X
          ), Ee.target = H, Ee.relatedTarget = Ge, k = Ee), Ge = k, Ee = z && B ? Q(
            z,
            B,
            pb
          ) : null, z !== null && dm(
            J,
            de,
            z,
            Ee,
            !1
          ), B !== null && Ge !== null && dm(
            J,
            Ge,
            B,
            Ee,
            !0
          )));
        }
        e: {
          if (z = w ? G(w) : window, B = z.nodeName && z.nodeName.toLowerCase(), B === "select" || B === "input" && z.type === "file")
            var he = C0;
          else if (T0(z))
            if (R0)
              he = Ey;
            else {
              he = by;
              var Pe = yy;
            }
          else
            B = z.nodeName, !B || B.toLowerCase() !== "input" || z.type !== "checkbox" && z.type !== "radio" ? w && Qa(w.elementType) && (he = C0) : he = Sy;
          if (he && (he = he(e, w))) {
            x0(
              J,
              he,
              n,
              X
            );
            break e;
          }
          Pe && Pe(e, z, w);
        }
        switch (Pe = w ? G(w) : window, e) {
          case "focusin":
            (T0(Pe) || Pe.contentEditable === "true") && (Uu = Pe, kc = w, Vi = null);
            break;
          case "focusout":
            Vi = kc = Uu = null;
            break;
          case "mousedown":
            Jc = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            Jc = !1, w0(J, n, X);
            break;
          case "selectionchange":
            if (xy) break;
          case "keydown":
          case "keyup":
            w0(J, n, X);
        }
        var Ce;
        if (Xc)
          e: {
            switch (e) {
              case "compositionstart":
                var we = "onCompositionStart";
                break e;
              case "compositionend":
                we = "onCompositionEnd";
                break e;
              case "compositionupdate":
                we = "onCompositionUpdate";
                break e;
            }
            we = void 0;
          }
        else
          ju ? S0(e, n) && (we = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (we = "onCompositionStart");
        we && (p0 && n.locale !== "ko" && (ju || we !== "onCompositionStart" ? we === "onCompositionEnd" && ju && (Ce = d0()) : (oa = X, Lc = "value" in oa ? oa.value : oa.textContent, ju = !0)), Pe = Zo(w, we), 0 < Pe.length && (we = new m0(
          we,
          e,
          null,
          n,
          X
        ), J.push({ event: we, listeners: Pe }), Ce ? we.data = Ce : (Ce = E0(n), Ce !== null && (we.data = Ce)))), (Ce = vy ? gy(e, n) : my(e, n)) && (we = Zo(w, "onBeforeInput"), 0 < we.length && (Pe = new m0(
          "onBeforeInput",
          "beforeinput",
          null,
          n,
          X
        ), J.push({
          event: Pe,
          listeners: we
        }), Pe.data = Ce)), vb(
          J,
          e,
          w,
          n,
          X
        );
      }
      sm(J, t);
    });
  }
  function sr(e, t, n) {
    return {
      instance: e,
      listener: t,
      currentTarget: n
    };
  }
  function Zo(e, t) {
    for (var n = t + "Capture", l = []; e !== null; ) {
      var u = e, i = u.stateNode;
      if (u = u.tag, u !== 5 && u !== 26 && u !== 27 || i === null || (u = Ul(e, n), u != null && l.unshift(
        sr(e, u, i)
      ), u = Ul(e, t), u != null && l.push(
        sr(e, u, i)
      )), e.tag === 3) return l;
      e = e.return;
    }
    return [];
  }
  function pb(e) {
    if (e === null) return null;
    do
      e = e.return;
    while (e && e.tag !== 5 && e.tag !== 27);
    return e || null;
  }
  function dm(e, t, n, l, u) {
    for (var i = t._reactName, s = []; n !== null && n !== l; ) {
      var v = n, T = v.alternate, w = v.stateNode;
      if (v = v.tag, T !== null && T === l) break;
      v !== 5 && v !== 26 && v !== 27 || w === null || (T = w, u ? (w = Ul(n, i), w != null && s.unshift(
        sr(n, w, T)
      )) : u || (w = Ul(n, i), w != null && s.push(
        sr(n, w, T)
      ))), n = n.return;
    }
    s.length !== 0 && e.push({ event: t, listeners: s });
  }
  var yb = /\r\n?/g, bb = /\u0000|\uFFFD/g;
  function vm(e) {
    return (typeof e == "string" ? e : "" + e).replace(yb, `
`).replace(bb, "");
  }
  function gm(e, t) {
    return t = vm(t), vm(e) === t;
  }
  function st(e, t, n, l, u, i) {
    switch (n) {
      case "children":
        if (typeof l == "string")
          t === "body" || t === "textarea" && l === "" || fn(e, l);
        else if (typeof l == "number" || typeof l == "bigint")
          t !== "body" && fn(e, "" + l);
        else return;
        break;
      case "className":
        On(e, "class", l);
        break;
      case "tabIndex":
        On(e, "tabindex", l);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        On(e, n, l);
        break;
      case "style":
        zn(e, l, i);
        return;
      case "data":
        if (t !== "object") {
          On(e, "data", l);
          break;
        }
      case "src":
      case "href":
        if (l === "" && (t !== "a" || n !== "href")) {
          e.removeAttribute(n);
          break;
        }
        if (l == null || typeof l == "function" || typeof l == "symbol" || typeof l == "boolean") {
          e.removeAttribute(n);
          break;
        }
        l = Jt(l), e.setAttribute(n, l);
        break;
      case "action":
      case "formAction":
        if (typeof l == "function") {
          e.setAttribute(
            n,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof i == "function" && (n === "formAction" ? (t !== "input" && st(e, t, "name", u.name, u, null), st(
            e,
            t,
            "formEncType",
            u.formEncType,
            u,
            null
          ), st(
            e,
            t,
            "formMethod",
            u.formMethod,
            u,
            null
          ), st(
            e,
            t,
            "formTarget",
            u.formTarget,
            u,
            null
          )) : (st(e, t, "encType", u.encType, u, null), st(e, t, "method", u.method, u, null), st(e, t, "target", u.target, u, null)));
        if (l == null || typeof l == "symbol" || typeof l == "boolean") {
          e.removeAttribute(n);
          break;
        }
        l = Jt(l), e.setAttribute(n, l);
        break;
      case "onClick":
        l != null && (e.onclick = dn);
        return;
      case "onScroll":
        l != null && ke("scroll", e);
        return;
      case "onScrollEnd":
        l != null && ke("scrollend", e);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l))
            throw Error(c(61));
          if (n = l.__html, n != null) {
            if (u.children != null) throw Error(c(60));
            i?.__html !== n && (e.innerHTML = n);
          }
        }
        break;
      case "multiple":
        e.multiple = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "muted":
        e.muted = l && typeof l != "function" && typeof l != "symbol";
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
        if (l == null || typeof l == "function" || typeof l == "boolean" || typeof l == "symbol") {
          e.removeAttribute("xlink:href");
          break;
        }
        n = Jt(l), e.setAttributeNS(
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
        l != null && typeof l != "function" && typeof l != "symbol" ? e.setAttribute(n, l) : e.removeAttribute(n);
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
        l && typeof l != "function" && typeof l != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
        break;
      case "capture":
      case "download":
        l === !0 ? e.setAttribute(n, "") : l !== !1 && l != null && typeof l != "function" && typeof l != "symbol" ? e.setAttribute(n, l) : e.removeAttribute(n);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        l != null && typeof l != "function" && typeof l != "symbol" && !isNaN(l) && 1 <= l ? e.setAttribute(n, l) : e.removeAttribute(n);
        break;
      case "rowSpan":
      case "start":
        l == null || typeof l == "function" || typeof l == "symbol" || isNaN(l) ? e.removeAttribute(n) : e.setAttribute(n, l);
        break;
      case "popover":
        ke("beforetoggle", e), ke("toggle", e), xt(e, "popover", l);
        break;
      case "xlinkActuate":
        wt(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          l
        );
        break;
      case "xlinkArcrole":
        wt(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          l
        );
        break;
      case "xlinkRole":
        wt(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          l
        );
        break;
      case "xlinkShow":
        wt(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          l
        );
        break;
      case "xlinkTitle":
        wt(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          l
        );
        break;
      case "xlinkType":
        wt(
          e,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          l
        );
        break;
      case "xmlBase":
        wt(
          e,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          l
        );
        break;
      case "xmlLang":
        wt(
          e,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          l
        );
        break;
      case "xmlSpace":
        wt(
          e,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          l
        );
        break;
      case "is":
        xt(e, "is", l);
        break;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N")
          n = Mi.get(n) || n, xt(e, n, l);
        else return;
    }
    Ne = !0;
  }
  function _f(e, t, n, l, u, i) {
    switch (n) {
      case "style":
        zn(e, l, i);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l))
            throw Error(c(61));
          if (n = l.__html, n != null) {
            if (u.children != null) throw Error(c(60));
            i?.__html !== n && (e.innerHTML = n);
          }
        }
        break;
      case "children":
        if (typeof l == "string") fn(e, l);
        else if (typeof l == "number" || typeof l == "bigint")
          fn(e, "" + l);
        else return;
        break;
      case "onScroll":
        l != null && ke("scroll", e);
        return;
      case "onScrollEnd":
        l != null && ke("scrollend", e);
        return;
      case "onClick":
        l != null && (e.onclick = dn);
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
        if (!Ue.hasOwnProperty(n))
          e: {
            if (n[0] === "o" && n[1] === "n" && (u = n.endsWith("Capture"), i = n.slice(2, u ? n.length - 7 : void 0), t = e[kt] || null, t = t != null ? t[n] : null, typeof t == "function" && e.removeEventListener(i, t, u), typeof l == "function")) {
              typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(i, l, u);
              break e;
            }
            Ne = !0, n in e ? e[n] = l : l === !0 ? e.setAttribute(n, "") : xt(e, n, l);
          }
        return;
    }
    Ne = !0;
  }
  function tn(e, t, n) {
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
        ke("error", e), ke("load", e);
        var l = !1, u = !1, i;
        for (i in n)
          if (n.hasOwnProperty(i)) {
            var s = n[i];
            if (s != null)
              switch (i) {
                case "src":
                  l = !0;
                  break;
                case "srcSet":
                  u = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(c(137, t));
                default:
                  st(e, t, i, s, n, null);
              }
          }
        u && st(e, t, "srcSet", n.srcSet, n, null), l && st(e, t, "src", n.src, n, null);
        return;
      case "input":
        ke("invalid", e);
        var v = i = s = u = null, T = null, w = null;
        for (l in n)
          if (n.hasOwnProperty(l)) {
            var X = n[l];
            if (X != null)
              switch (l) {
                case "name":
                  u = X;
                  break;
                case "type":
                  s = X;
                  break;
                case "checked":
                  T = X;
                  break;
                case "defaultChecked":
                  w = X;
                  break;
                case "value":
                  i = X;
                  break;
                case "defaultValue":
                  v = X;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (X != null)
                    throw Error(c(137, t));
                  break;
                default:
                  st(e, t, l, X, n, null);
              }
          }
        ia(
          e,
          i,
          v,
          T,
          w,
          s,
          u,
          !1
        );
        return;
      case "select":
        ke("invalid", e), l = s = i = null;
        for (u in n)
          if (n.hasOwnProperty(u) && (v = n[u], v != null))
            switch (u) {
              case "value":
                i = v;
                break;
              case "defaultValue":
                s = v;
                break;
              case "multiple":
                l = v;
              default:
                st(e, t, u, v, n, null);
            }
        t = i, n = s, e.multiple = !!l, t != null ? bn(e, !!l, t, !1) : n != null && bn(e, !!l, n, !0);
        return;
      case "textarea":
        ke("invalid", e), i = u = l = null;
        for (s in n)
          if (n.hasOwnProperty(s) && (v = n[s], v != null))
            switch (s) {
              case "value":
                l = v;
                break;
              case "defaultValue":
                u = v;
                break;
              case "children":
                i = v;
                break;
              case "dangerouslySetInnerHTML":
                if (v != null) throw Error(c(91));
                break;
              default:
                st(e, t, s, v, n, null);
            }
        Nn(e, l, u, i);
        return;
      case "option":
        for (T in n)
          n.hasOwnProperty(T) && (l = n[T], l != null) && (T === "selected" ? e.selected = l && typeof l != "function" && typeof l != "symbol" : st(e, t, T, l, n, null));
        return;
      case "dialog":
        ke("beforetoggle", e), ke("toggle", e), ke("cancel", e), ke("close", e);
        break;
      case "iframe":
      case "object":
        ke("load", e);
        break;
      case "video":
      case "audio":
        for (l = 0; l < cr.length; l++)
          ke(cr[l], e);
        break;
      case "image":
        ke("error", e), ke("load", e);
        break;
      case "details":
        ke("toggle", e);
        break;
      case "embed":
      case "source":
      case "link":
        ke("error", e), ke("load", e);
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
        for (w in n)
          if (n.hasOwnProperty(w) && (l = n[w], l != null))
            switch (w) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(c(137, t));
              default:
                st(e, t, w, l, n, null);
            }
        return;
      default:
        if (Qa(t)) {
          for (X in n)
            n.hasOwnProperty(X) && (l = n[X], l !== void 0 && _f(
              e,
              t,
              X,
              l,
              n,
              void 0
            ));
          return;
        }
    }
    for (v in n)
      n.hasOwnProperty(v) && (l = n[v], l != null && st(e, t, v, l, n, null));
  }
  var Sb = {};
  function Eb(e, t, n, l) {
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
        var u = null, i = null, s = null, v = null, T = null, w = null, X = null;
        for (B in n) {
          var J = n[B];
          if (n.hasOwnProperty(B) && J != null)
            switch (B) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                T = J;
              default:
                l.hasOwnProperty(B) || st(e, t, B, null, l, J);
            }
        }
        for (var z in l) {
          var B = l[z];
          if (J = n[z], l.hasOwnProperty(z) && (B != null || J != null))
            switch (z) {
              case "type":
                B !== J && (Ne = !0), i = B;
                break;
              case "name":
                B !== J && (Ne = !0), u = B;
                break;
              case "checked":
                B !== J && (Ne = !0), w = B;
                break;
              case "defaultChecked":
                B !== J && (Ne = !0), X = B;
                break;
              case "value":
                B !== J && (Ne = !0), s = B;
                break;
              case "defaultValue":
                B !== J && (Ne = !0), v = B;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (B != null)
                  throw Error(c(137, t));
                break;
              default:
                B !== J && st(
                  e,
                  t,
                  z,
                  B,
                  l,
                  J
                );
            }
        }
        rn(
          e,
          s,
          v,
          T,
          w,
          X,
          i,
          u
        );
        return;
      case "select":
        B = s = v = z = null;
        for (i in n)
          if (T = n[i], n.hasOwnProperty(i) && T != null)
            switch (i) {
              case "value":
                break;
              case "multiple":
                B = T;
              default:
                l.hasOwnProperty(i) || st(
                  e,
                  t,
                  i,
                  null,
                  l,
                  T
                );
            }
        for (u in l)
          if (i = l[u], T = n[u], l.hasOwnProperty(u) && (i != null || T != null))
            switch (u) {
              case "value":
                i !== T && (Ne = !0), z = i;
                break;
              case "defaultValue":
                i !== T && (Ne = !0), v = i;
                break;
              case "multiple":
                i !== T && (Ne = !0), s = i;
              default:
                i !== T && st(
                  e,
                  t,
                  u,
                  i,
                  l,
                  T
                );
            }
        t = v, n = s, l = B, z != null ? bn(e, !!n, z, !1) : !!l != !!n && (t != null ? bn(e, !!n, t, !0) : bn(e, !!n, n ? [] : "", !1));
        return;
      case "textarea":
        B = z = null;
        for (v in n)
          if (u = n[v], n.hasOwnProperty(v) && u != null && !l.hasOwnProperty(v))
            switch (v) {
              case "value":
                break;
              case "children":
                break;
              default:
                st(e, t, v, null, l, u);
            }
        for (s in l)
          if (u = l[s], i = n[s], l.hasOwnProperty(s) && (u != null || i != null))
            switch (s) {
              case "value":
                u !== i && (Ne = !0), z = u;
                break;
              case "defaultValue":
                u !== i && (Ne = !0), B = u;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (u != null) throw Error(c(91));
                break;
              default:
                u !== i && st(e, t, s, u, l, i);
            }
        wu(e, z, B);
        return;
      case "option":
        for (var de in n)
          z = n[de], n.hasOwnProperty(de) && z != null && !l.hasOwnProperty(de) && (de === "selected" ? e.selected = !1 : st(
            e,
            t,
            de,
            null,
            l,
            z
          ));
        for (T in l)
          z = l[T], B = n[T], l.hasOwnProperty(T) && z !== B && (z != null || B != null) && (T === "selected" ? (z !== B && (Ne = !0), e.selected = z && typeof z != "function" && typeof z != "symbol") : st(
            e,
            t,
            T,
            z,
            l,
            B
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
        for (var Ee in n)
          z = n[Ee], n.hasOwnProperty(Ee) && z != null && !l.hasOwnProperty(Ee) && st(e, t, Ee, null, l, z);
        for (w in l)
          if (z = l[w], B = n[w], l.hasOwnProperty(w) && z !== B && (z != null || B != null))
            switch (w) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (z != null)
                  throw Error(c(137, t));
                break;
              default:
                st(
                  e,
                  t,
                  w,
                  z,
                  l,
                  B
                );
            }
        return;
      default:
        if (Qa(t)) {
          for (var Ge in n)
            z = n[Ge], n.hasOwnProperty(Ge) && z !== void 0 && !l.hasOwnProperty(Ge) && _f(
              e,
              t,
              Ge,
              void 0,
              l,
              z
            );
          for (X in l)
            z = l[X], B = n[X], !l.hasOwnProperty(X) || z === B || z === void 0 && B === void 0 || _f(
              e,
              t,
              X,
              z,
              l,
              B
            );
          return;
        }
    }
    for (var D in n)
      z = n[D], n.hasOwnProperty(D) && z != null && !l.hasOwnProperty(D) && st(e, t, D, null, l, z);
    for (J in l)
      z = l[J], B = n[J], !l.hasOwnProperty(J) || z === B || z == null && B == null || st(e, t, J, z, l, B);
  }
  function mm(e) {
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
  function Tb() {
    if (typeof performance.getEntriesByType == "function") {
      for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), l = 0; l < n.length; l++) {
        var u = n[l], i = u.transferSize, s = u.initiatorType, v = u.duration;
        if (i && v && mm(s)) {
          for (s = 0, v = u.responseEnd, l += 1; l < n.length; l++) {
            var T = n[l], w = T.startTime;
            if (w > v) break;
            var X = T.transferSize, J = T.initiatorType;
            X && mm(J) && (T = T.responseEnd, s += X * (T < v ? 1 : (v - w) / (T - w)));
          }
          if (--l, t += 8 * (i + s) / (u.duration / 1e3), e++, 10 < e) break;
        }
      }
      if (0 < e) return t / e / 1e6;
    }
    return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
  }
  var wf = null, jf = null;
  function fr(e) {
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  function hm(e) {
    switch (e) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function pm(e, t) {
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
  function ym(e, t, n, l) {
    return n = fr(
      n
    ).createElement(e), n[Tt] = l, n[kt] = t, tn(n, e, t), ee(n), n;
  }
  function Uf(e, t) {
    return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
  }
  var Hf = null;
  function xb() {
    var e = window.event;
    return e && e.type === "popstate" ? e === Hf ? !1 : (Hf = e, !0) : (Hf = null, !1);
  }
  var Bf = typeof setTimeout == "function" ? setTimeout : void 0, Cb = typeof clearTimeout == "function" ? clearTimeout : void 0, bm = typeof Promise == "function" ? Promise : void 0, Sm = typeof requestAnimationFrame == "function" ? requestAnimationFrame : Bf, Rb = typeof queueMicrotask == "function" ? queueMicrotask : typeof bm < "u" ? function(e) {
    return bm.resolve(null).then(e).catch(Ab);
  } : Bf;
  function Ab(e) {
    setTimeout(function() {
      throw e;
    });
  }
  function Na(e) {
    return e === "head";
  }
  function Em(e, t) {
    var n = t, l = 0;
    do {
      var u = n.nextSibling;
      if (e.removeChild(n), u && u.nodeType === 8)
        if (n = u.data, n === "/$" || n === "/&") {
          if (l === 0) {
            e.removeChild(u), gi(t);
            return;
          }
          l--;
        } else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&")
          l++;
        else if (n === "html")
          Kf(
            e.ownerDocument.documentElement
          );
        else if (n === "head") {
          n = e.ownerDocument.head, Kf(n);
          for (var i = n.firstChild; i; ) {
            var s = i.nextSibling, v = i.nodeName;
            i[Ga] || v === "SCRIPT" || v === "STYLE" || v === "LINK" && i.rel.toLowerCase() === "stylesheet" || n.removeChild(i), i = s;
          }
        } else
          n === "body" && Kf(e.ownerDocument.body);
      n = u;
    } while (n);
    gi(t);
  }
  function Tm(e, t) {
    var n = e;
    e = 0;
    do {
      var l = n.nextSibling;
      if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), l && l.nodeType === 8)
        if (n = l.data, n === "/$") {
          if (e === 0) break;
          e--;
        } else
          n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
      n = l;
    } while (n);
  }
  function xm(e, t, n) {
    if (t = CSS.escape(t) !== t ? "r-" + btoa(t).replace(/=/g, "") : t, e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
      if (t = e.getClientRects(), t.length === 1) var l = 1;
      else
        for (var u = l = 0; u < t.length; u++) {
          var i = t[u];
          0 < i.width && 0 < i.height && l++;
        }
      l === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
    }
  }
  function Cm(e, t) {
    e = e.style, t = t.style;
    var n = t != null ? t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null : null;
    e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t != null ? t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n != null ? e.margin = n : (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t)));
  }
  function Ob(e, t, n) {
    return n = n.ownerDocument.defaultView, {
      rect: e,
      abs: t.position === "absolute" || t.position === "fixed",
      clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
      view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
    };
  }
  function Lf(e) {
    var t = e.getBoundingClientRect(), n = getComputedStyle(e);
    return Ob(t, n, e);
  }
  function Nb(e) {
    return e.documentElement.clientHeight;
  }
  function zb(e) {
    this.addEventListener("load", e), this.addEventListener("error", e);
  }
  function Mb(e, t, n, l, u, i, s, v, T) {
    var w = t.nodeType === 9 ? t : t.ownerDocument;
    try {
      var X = w.startViewTransition({
        update: function() {
          var z = w.defaultView, B = z.navigation && z.navigation.transition, de = w.fonts.status;
          l();
          var Ee = [];
          if (de === "loaded" && (Nb(w), w.fonts.status === "loading" && Ee.push(w.fonts.ready)), de = Ee.length, e !== null)
            for (var Ge = e.suspenseyImages, D = 0, C = 0; C < Ge.length; C++) {
              var H = Ge[C];
              if (!H.complete) {
                var k = H.getBoundingClientRect();
                if (0 < k.bottom && 0 < k.right && k.top < z.innerHeight && k.left < z.innerWidth) {
                  if (D += Km(H), D > Fo) {
                    Ee.length = de;
                    break;
                  }
                  H = new Promise(
                    zb.bind(H)
                  ), Ee.push(H);
                }
              }
            }
          if (0 < Ee.length)
            return z = Promise.race([
              Promise.all(Ee),
              new Promise(function(he) {
                return setTimeout(he, 500);
              })
            ]).then(u, u), (B ? Promise.allSettled([B.finished, z]) : z).then(i, i);
          if (u(), B)
            return B.finished.then(
              i,
              i
            );
          i();
        },
        types: n
      });
      w.__reactViewTransition = X;
      var J = [];
      return X.ready.then(
        function() {
          for (var z = w.documentElement.getAnimations({
            subtree: !0
          }), B = 0; B < z.length; B++) {
            var de = z[B], Ee = de.effect, Ge = Ee.pseudoElement;
            if (Ge != null && Ge.startsWith("::view-transition")) {
              J.push(de), de = Ee.getKeyframes();
              for (var D = Ge = void 0, C = !0, H = 0; H < de.length; H++) {
                var k = de[H], he = k.width;
                if (Ge === void 0) Ge = he;
                else if (Ge !== he) {
                  C = !1;
                  break;
                }
                if (he = k.height, D === void 0) D = he;
                else if (D !== he) {
                  C = !1;
                  break;
                }
                delete k.width, delete k.height, k.transform === "none" && delete k.transform;
              }
              C && Ge !== void 0 && D !== void 0 && (Ee.setKeyframes(de), C = getComputedStyle(
                Ee.target,
                Ee.pseudoElement
              ), C.width !== Ge || C.height !== D) && (C = de[0], C.width = Ge, C.height = D, C = de[de.length - 1], C.width = Ge, C.height = D, Ee.setKeyframes(de));
            }
          }
          s();
        },
        function(z) {
          w.__reactViewTransition === X && (w.__reactViewTransition = null);
          try {
            typeof z == "object" && z !== null && z.name === "InvalidStateError" && (z.message === "View transition was skipped because document visibility state is hidden." || z.message === "Skipping view transition because document visibility state has become hidden." || z.message === "Skipping view transition because viewport size changed." || z.message === "Transition was aborted because of invalid state") && (z = null), z !== null && T(z);
          } finally {
            l(), u(), s();
          }
        }
      ), X.finished.finally(function() {
        for (var z = 0; z < J.length; z++)
          J[z].cancel();
        w.__reactViewTransition === X && (w.__reactViewTransition = null), v();
      }), X;
    } catch {
      return l(), u(), s(), null;
    }
  }
  function gu(e, t) {
    this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
  }
  gu.prototype.animate = function(e, t) {
    return t = typeof t == "number" ? { duration: t } : L({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
  }, gu.prototype.getAnimations = function() {
    for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), l = [], u = 0; u < n.length; u++) {
      var i = n[u].effect;
      i !== null && i.target === e && i.pseudoElement === t && l.push(n[u]);
    }
    return l;
  }, gu.prototype.getComputedStyle = function() {
    return getComputedStyle(this._scope, this._selector);
  };
  function Rm(e) {
    return {
      name: e,
      group: new gu("group", e),
      imagePair: new gu("image-pair", e),
      old: new gu("old", e),
      new: new gu("new", e)
    };
  }
  function Bn(e) {
    this._fragmentFiber = e, this._observers = this._eventListeners = null;
  }
  Bn.prototype.addEventListener = function(e, t, n) {
    var l = null, u = null;
    if (!(n != null && typeof n != "boolean" && (l = n.signal || null, l !== null && l.aborted))) {
      this._eventListeners === null && (this._eventListeners = []);
      var i = this._eventListeners;
      if (Om(i, e, t, n) === -1) {
        var s = this, v = t;
        n != null && typeof n != "boolean" && n.once === !0 && (v = function(T) {
          s.removeEventListener(
            e,
            t,
            n
          ), typeof t == "function" ? t.call(this, T) : t.handleEvent(T);
        }), l !== null && (u = s.removeEventListener.bind(
          s,
          e,
          t,
          n
        ), l.addEventListener("abort", u, { once: !0 }), u = l.removeEventListener.bind(l, "abort", u)), l = oi(n), i.push({
          type: e,
          listener: t,
          optionsOrUseCapture: n,
          attachedListener: v,
          cleanup: u
        }), g(
          this._fragmentFiber.child,
          !1,
          Db,
          e,
          v,
          l
        );
      }
      this._eventListeners = i;
    }
  };
  function Db(e, t, n, l) {
    return _(e).addEventListener(
      t,
      n,
      l
    ), !1;
  }
  Bn.prototype.removeEventListener = function(e, t, n) {
    var l = this._eventListeners;
    if (l !== null && (t = Om(
      l,
      e,
      t,
      n
    ), t !== -1)) {
      var u = l[t];
      n = u.attachedListener;
      var i = u.cleanup;
      u = oi(u.optionsOrUseCapture), g(
        this._fragmentFiber.child,
        !1,
        _b,
        e,
        n,
        u
      ), l.splice(t, 1), i !== null && i();
    }
  };
  function _b(e, t, n, l) {
    return _(e).removeEventListener(
      t,
      n,
      l
    ), !1;
  }
  function oi(e) {
    return e != null && typeof e != "boolean" && (e.once === !0 || e.signal instanceof AbortSignal) ? { capture: e.capture, passive: e.passive } : e;
  }
  function Am(e) {
    return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
  }
  function Om(e, t, n, l) {
    if (e.length === 0) return -1;
    l = Am(l);
    for (var u = 0; u < e.length; u++) {
      var i = e[u];
      if (i.type === t && i.listener === n && Am(i.optionsOrUseCapture) === l)
        return u;
    }
    return -1;
  }
  Bn.prototype.dispatchEvent = function(e) {
    var t = x(
      this._fragmentFiber
    );
    if (t === null) return !0;
    t = _(t);
    var n = this._eventListeners;
    if (n !== null && 0 < n.length || !e.bubbles) {
      var l = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
      if (n)
        for (var u = 0; u < n.length; u++) {
          var i = n[u];
          l.addEventListener(
            i.type,
            i.attachedListener,
            oi(i.optionsOrUseCapture)
          );
        }
      if (t.appendChild(l), e = l.dispatchEvent(e), n)
        for (u = 0; u < n.length; u++)
          i = n[u], l.removeEventListener(
            i.type,
            i.attachedListener,
            oi(i.optionsOrUseCapture)
          );
      return t.removeChild(l), e;
    }
    return t.dispatchEvent(e);
  }, Bn.prototype.focus = function(e) {
    g(
      this._fragmentFiber.child,
      !0,
      Nm,
      e,
      void 0,
      void 0
    );
  };
  function Nm(e, t) {
    return e.tag === 6 ? !1 : (e = _(e), Qb(e, t));
  }
  Bn.prototype.focusLast = function(e) {
    var t = [];
    g(
      this._fragmentFiber.child,
      !0,
      Vf,
      t,
      void 0,
      void 0
    );
    for (var n = t.length - 1; 0 <= n && !Nm(t[n], e); n--) ;
  };
  function Vf(e, t) {
    return t.push(e), !1;
  }
  Bn.prototype.blur = function() {
    var e = x(
      this._fragmentFiber
    );
    e !== null && (e = _(e), e = fr(e).activeElement, e !== null && g(
      this._fragmentFiber.child,
      !1,
      wb,
      e,
      void 0,
      void 0
    ));
  };
  function wb(e, t) {
    return e.tag === 6 ? !1 : (e = _(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
  }
  Bn.prototype.observeUsing = function(e) {
    this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), g(
      this._fragmentFiber.child,
      !1,
      jb,
      e,
      void 0,
      void 0
    );
  };
  function jb(e, t) {
    return e.tag === 6 || (e = _(e), t.observe(e)), !1;
  }
  Bn.prototype.unobserveUsing = function(e) {
    var t = this._observers;
    if (t !== null && t.has(e)) {
      t.delete(e), g(
        this._fragmentFiber.child,
        !1,
        Ub,
        e,
        void 0,
        void 0
      );
      for (var n = t = 0; n < fl.length; n++) {
        var l = fl[n];
        l.fragmentInstance === this && l.observer === e ? e.unobserve(l.instance) : fl[t++] = l;
      }
      fl.length = t;
    }
  };
  function Ub(e, t) {
    return e.tag === 6 || (e = _(e), t.unobserve(e)), !1;
  }
  var fl = [], qf = !1;
  function Hb(e, t, n) {
    fl.push({
      fragmentInstance: e,
      observer: t,
      instance: n
    }), qf || (qf = !0, Kb(function() {
      qf = !1;
      var l = fl;
      fl = [];
      for (var u = 0; u < l.length; u++) {
        var i = l[u];
        i.observer.unobserve(i.instance);
      }
    }));
  }
  Bn.prototype.getClientRects = function() {
    var e = [];
    return g(
      this._fragmentFiber.child,
      !1,
      Bb,
      e,
      void 0,
      void 0
    ), e;
  };
  function Bb(e, t) {
    if (e.tag === 6) {
      e = e.stateNode;
      var n = e.ownerDocument.createRange();
      n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
    } else
      e = _(e), t.push.apply(t, e.getClientRects());
    return !1;
  }
  Bn.prototype.getRootNode = function(e) {
    var t = x(
      this._fragmentFiber
    );
    return t === null ? this : _(t).getRootNode(e);
  }, Bn.prototype.compareDocumentPosition = function(e) {
    var t = x(
      this._fragmentFiber
    );
    if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
    var n = [];
    g(
      this._fragmentFiber.child,
      !1,
      Vf,
      n,
      void 0,
      void 0
    );
    var l = _(t);
    if (n.length === 0) {
      if (n = l, q(this._fragmentFiber)) {
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
      var u = l = n.compareDocumentPosition(e);
      return n === e ? u = Node.DOCUMENT_POSITION_CONTAINS : l & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = j(t)[1], n === null ? u = Node.DOCUMENT_POSITION_PRECEDING : (e = _(n).compareDocumentPosition(
        e
      ), u = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), u |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
    }
    t = _(n[0]), u = _(n[n.length - 1]);
    var i = q(this._fragmentFiber) ? t.parentElement : l;
    if (i == null)
      return Node.DOCUMENT_POSITION_DISCONNECTED;
    l = i.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, i = i.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_CONTAINED_BY;
    var s = t.compareDocumentPosition(e), v = u.compareDocumentPosition(e), T = s & Node.DOCUMENT_POSITION_CONTAINED_BY || v & Node.DOCUMENT_POSITION_CONTAINED_BY;
    return v = l && i && s & Node.DOCUMENT_POSITION_FOLLOWING && v & Node.DOCUMENT_POSITION_PRECEDING, t = l && t === e || i && u === e || T || v ? Node.DOCUMENT_POSITION_CONTAINED_BY : !l && t === e || !i && u === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : s, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || Lb(
      t,
      this._fragmentFiber,
      n[0],
      n[n.length - 1],
      e
    ) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
  };
  function Lb(e, t, n, l, u) {
    var i = ul(u);
    if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      if (n = !!i)
        e: {
          for (; i !== null; ) {
            if (i.tag === 7 && (i === t || i.alternate === t)) {
              n = !0;
              break e;
            }
            i = i.return;
          }
          n = !1;
        }
      return n;
    }
    if (e & Node.DOCUMENT_POSITION_CONTAINS) {
      if (i === null)
        return i = u.ownerDocument, u === i || u === i.documentElement || u === i.body;
      e: {
        for (i = t, t = x(t); i !== null; ) {
          if (!(i.tag !== 5 && i.tag !== 3 && i.tag !== 27 || i !== t && i.alternate !== t)) {
            i = !0;
            break e;
          }
          i = i.return;
        }
        i = !1;
      }
      return i;
    }
    return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!i) && !(t = i === n) && (t = Q(
      n,
      i,
      N
    ), t === null ? t = !1 : (g(
      t,
      !0,
      F,
      i,
      n
    ), i = R, R = null, t = i !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!i) && !(t = i === l) && (t = Q(
      l,
      i,
      N
    ), t === null ? t = !1 : (g(
      t,
      !0,
      A,
      i,
      l
    ), i = R, M = R = null, t = i !== null)), t) : !1;
  }
  function zm(e, t) {
    var n = e.ownerDocument.createRange();
    n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(
      window.scrollX + e.left,
      t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight
    );
  }
  Bn.prototype.scrollIntoView = function(e) {
    if (typeof e == "object") throw Error(c(566));
    var t = [];
    g(
      this._fragmentFiber.child,
      !1,
      Vf,
      t,
      void 0,
      void 0
    );
    var n = e !== !1;
    if (t.length === 0) {
      var l = j(
        this._fragmentFiber
      );
      if (l = n ? l[1] || l[0] || x(this._fragmentFiber) : l[0] || l[1], l === null) return;
      if (l.tag === 6) {
        e = _(l), zm(e, n);
        return;
      }
      if (l = _(l), l.nodeType !== 9) {
        if (l.nodeType === 11) {
          n = "host" in l ? l.host : null, n !== null && n.scrollIntoView(e);
          return;
        }
        l.scrollIntoView(e);
      }
    }
    for (l = n ? t.length - 1 : 0; l !== (n ? -1 : t.length); ) {
      var u = t[l];
      u.tag === 6 ? (u = _(u), zm(u, n)) : _(u).scrollIntoView(e), l += n ? -1 : 1;
    }
  };
  function Vb(e, t) {
    return e = _(e), Mm(e, t), !1;
  }
  function Mm(e, t) {
    e.reactFragments == null && (e.reactFragments = /* @__PURE__ */ new Set()), e.reactFragments.add(t);
  }
  function Dm(e, t) {
    var n = t._eventListeners;
    if (n !== null)
      for (var l = 0; l < n.length; l++) {
        var u = n[l];
        e.addEventListener(
          u.type,
          u.attachedListener,
          oi(u.optionsOrUseCapture)
        );
      }
    e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(i) {
      for (var s = 0, v = 0; v < fl.length; v++) {
        var T = fl[v];
        (T.fragmentInstance !== t || T.observer !== i || T.instance !== e) && (fl[s++] = T);
      }
      fl.length = s, i.observe(e);
    }), Mm(e, t));
  }
  function qb(e, t) {
    var n = t._eventListeners;
    if (n !== null)
      for (var l = 0; l < n.length; l++) {
        var u = n[l];
        e.removeEventListener(
          u.type,
          u.attachedListener,
          oi(u.optionsOrUseCapture)
        );
      }
    e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(i) {
      typeof i.rootMargin == "string" ? Hb(
        t,
        i,
        e
      ) : i.unobserve(e);
    }), e.reactFragments != null && e.reactFragments.delete(t));
  }
  function Yf(e) {
    var t = e.firstChild;
    for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
      var n = t;
      switch (t = t.nextSibling, n.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          Yf(n), zu(n);
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
  function Yb(e, t, n, l) {
    for (; e.nodeType === 1; ) {
      var u = n;
      if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
        if (!l && (e.nodeName !== "INPUT" || e.type !== "hidden"))
          break;
      } else if (l) {
        if (!e[Ga])
          switch (t) {
            case "meta":
              if (!e.hasAttribute("itemprop")) break;
              return e;
            case "link":
              if (i = e.getAttribute("rel"), i === "stylesheet" && e.hasAttribute("data-precedence"))
                break;
              if (i !== u.rel || e.getAttribute("href") !== (u.href == null || u.href === "" ? null : u.href) || e.getAttribute("crossorigin") !== (u.crossOrigin == null ? null : u.crossOrigin) || e.getAttribute("title") !== (u.title == null ? null : u.title))
                break;
              return e;
            case "style":
              if (e.hasAttribute("data-precedence")) break;
              return e;
            case "script":
              if (i = e.getAttribute("src"), (i !== (u.src == null ? null : u.src) || e.getAttribute("type") !== (u.type == null ? null : u.type) || e.getAttribute("crossorigin") !== (u.crossOrigin == null ? null : u.crossOrigin)) && i && e.hasAttribute("async") && !e.hasAttribute("itemprop"))
                break;
              return e;
            default:
              return e;
          }
      } else if (t === "input" && e.type === "hidden") {
        var i = u.name == null ? null : "" + u.name;
        if (u.type === "hidden" && e.getAttribute("name") === i)
          return e;
      } else return e;
      if (e = Jn(e.nextSibling), e === null) break;
    }
    return null;
  }
  function Gb(e, t, n) {
    if (t === "") return null;
    for (; e.nodeType !== 3; )
      if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = Jn(e.nextSibling), e === null)) return null;
    return e;
  }
  function _m(e, t) {
    for (; e.nodeType !== 8; )
      if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = Jn(e.nextSibling), e === null)) return null;
    return e;
  }
  function Gf(e) {
    return e.data === "$?" || e.data === "$~";
  }
  function Xf(e) {
    return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
  }
  function Xb(e, t) {
    var n = e.ownerDocument;
    if (e.data === "$~") e._reactRetry = t;
    else if (e.data !== "$?" || n.readyState !== "loading")
      t();
    else {
      var l = function() {
        t(), n.removeEventListener("DOMContentLoaded", l);
      };
      n.addEventListener("DOMContentLoaded", l), e._reactRetry = l;
    }
  }
  function Jn(e) {
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
  var Qf = null;
  function wm(e) {
    e = e.nextSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var n = e.data;
        if (n === "/$" || n === "/&") {
          if (t === 0)
            return Jn(e.nextSibling);
          t--;
        } else
          n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
      }
      e = e.nextSibling;
    }
    return null;
  }
  function jm(e) {
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
  function Qb(e, t) {
    function n() {
      l = !0;
    }
    if (e.ownerDocument.activeElement === e) return !0;
    var l = !1;
    try {
      e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
    } finally {
      e.ownerDocument.removeEventListener("focus", n, !0);
    }
    return l;
  }
  function Kb(e) {
    Sm(function() {
      Sm(function(t) {
        return e(t);
      });
    });
  }
  function Um(e, t, n) {
    switch (t = fr(n), e) {
      case "html":
        if (e = t.documentElement, !e) throw Error(c(452));
        return e;
      case "head":
        if (e = t.head, !e) throw Error(c(453));
        return e;
      case "body":
        if (e = t.body, !e) throw Error(c(454));
        return e;
      default:
        throw Error(c(451));
    }
  }
  function Hm(e, t, n) {
    for (var l in n) {
      var u = n[l];
      n.hasOwnProperty(l) && u != null && st(e, t, l, null, Sb, u);
    }
    n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === dn && (e.onclick = null), zu(e);
  }
  function Kf(e) {
    for (var t = e.attributes; t.length; )
      e.removeAttributeNode(t[0]);
    zu(e);
  }
  var Fn = /* @__PURE__ */ new Map(), Bm = /* @__PURE__ */ new Set();
  function dr(e) {
    if (typeof e.getRootNode == "function") {
      var t = e.getRootNode();
      if (t.nodeType === 9 || t.nodeType === 11) return t;
    }
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  var Zl = ve.d;
  ve.d = {
    f: Ib,
    r: Zb,
    D: kb,
    C: Jb,
    L: Fb,
    m: Pb,
    X: $b,
    S: Wb,
    M: e1
  };
  function Ib() {
    var e = Zl.f(), t = Yo();
    return e || t;
  }
  function Zb(e) {
    var t = Xa(e);
    t !== null && t.tag === 5 && t.type === "form" ? Vv(t) : Zl.r(e);
  }
  var ci = typeof document > "u" ? null : document;
  function Lm(e, t, n) {
    var l = ci;
    if (l && typeof t == "string" && t) {
      var u = yt(t);
      u = 'link[rel="' + e + '"][href="' + u + '"]', typeof n == "string" && (u += '[crossorigin="' + n + '"]'), Bm.has(u) || (Bm.add(u), e = { rel: e, crossOrigin: n, href: t }, l.querySelector(u) === null && (t = l.createElement("link"), tn(t, "link", e), ee(t), l.head.appendChild(t)));
    }
  }
  function kb(e) {
    Zl.D(e), Lm("dns-prefetch", e, null);
  }
  function Jb(e, t) {
    Zl.C(e, t), Lm("preconnect", e, t);
  }
  function Fb(e, t, n) {
    Zl.L(e, t, n);
    var l = ci;
    if (l && e && t) {
      var u = 'link[rel="preload"][as="' + yt(t) + '"]';
      t === "image" && n && n.imageSrcSet ? (u += '[imagesrcset="' + yt(
        n.imageSrcSet
      ) + '"]', typeof n.imageSizes == "string" && (u += '[imagesizes="' + yt(
        n.imageSizes
      ) + '"]')) : u += '[href="' + yt(e) + '"]';
      var i = u;
      switch (t) {
        case "style":
          i = si(e);
          break;
        case "script":
          i = fi(e);
      }
      if (!(Fn.has(i) || (e = L(
        {
          rel: "preload",
          href: t === "image" && n && n.imageSrcSet ? void 0 : e,
          as: t
        },
        n
      ), Fn.set(i, e), l.querySelector(u) !== null || t === "style" && l.querySelector(vr(i)) || t === "script" && l.querySelector(gr(i))))) {
        var s = l.createElement("link");
        tn(s, "link", e), t === "style" && (s[Nu] = !0, s.onload = s.onerror = function() {
          xe(s);
        }), ee(s), l.head.appendChild(s);
      }
    }
  }
  function Pb(e, t) {
    Zl.m(e, t);
    var n = ci;
    if (n && e) {
      var l = t && typeof t.as == "string" ? t.as : "script", u = 'link[rel="modulepreload"][as="' + yt(l) + '"][href="' + yt(e) + '"]', i = u;
      switch (l) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          i = fi(e);
      }
      if (!Fn.has(i) && (e = L({ rel: "modulepreload", href: e }, t), Fn.set(i, e), n.querySelector(u) === null)) {
        switch (l) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (n.querySelector(gr(i)))
              return;
        }
        l = n.createElement("link"), tn(l, "link", e), ee(l), n.head.appendChild(l);
      }
    }
  }
  function Wb(e, t, n) {
    Zl.S(e, t, n);
    var l = ci;
    if (l && e) {
      var u = $(l).hoistableStyles, i = si(e);
      t = t || "default";
      var s = u.get(i);
      if (!s) {
        var v = { loading: 0, preload: null };
        if (s = l.querySelector(
          vr(i)
        ))
          v.loading = 5;
        else {
          e = L(
            { rel: "stylesheet", href: e, "data-precedence": t },
            n
          ), (n = Fn.get(i)) && If(e, n);
          var T = s = l.createElement("link");
          ee(T), tn(T, "link", e), T._p = new Promise(function(w, X) {
            T.onload = w, T.onerror = X;
          }), T.addEventListener("load", function() {
            v.loading |= 1;
          }), T.addEventListener("error", function() {
            v.loading |= 2;
          }), v.loading |= 4, ko(s, t, l);
        }
        s = {
          type: "stylesheet",
          instance: s,
          count: 1,
          state: v
        }, u.set(i, s);
      }
    }
  }
  function $b(e, t) {
    Zl.X(e, t);
    var n = ci;
    if (n && e) {
      var l = $(n).hoistableScripts, u = fi(e), i = l.get(u);
      i || (i = n.querySelector(gr(u)), i || (e = L({ src: e, async: !0 }, t), (t = Fn.get(u)) && Zf(e, t), i = n.createElement("script"), ee(i), tn(i, "link", e), n.head.appendChild(i)), i = {
        type: "script",
        instance: i,
        count: 1,
        state: null
      }, l.set(u, i));
    }
  }
  function e1(e, t) {
    Zl.M(e, t);
    var n = ci;
    if (n && e) {
      var l = $(n).hoistableScripts, u = fi(e), i = l.get(u);
      i || (i = n.querySelector(gr(u)), i || (e = L({ src: e, async: !0, type: "module" }, t), (t = Fn.get(u)) && Zf(e, t), i = n.createElement("script"), ee(i), tn(i, "link", e), n.head.appendChild(i)), i = {
        type: "script",
        instance: i,
        count: 1,
        state: null
      }, l.set(u, i));
    }
  }
  function Vm(e, t, n, l) {
    var u = (u = Re.current) ? dr(u) : null;
    if (!u) throw Error(c(446));
    switch (e) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof n.precedence == "string" && typeof n.href == "string" ? (n = si(n.href), t = $(
          u
        ).hoistableStyles, l = t.get(n), l || (l = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, t.set(n, l)), l) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
          e = si(n.href);
          var i = $(
            u
          ).hoistableStyles, s = i.get(e);
          if (s || (u = u.ownerDocument || u, s = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, i.set(e, s), (i = u.querySelector(
            vr(e)
          )) ? i._p || (s.instance = i, s.state.loading = 5) : (i = Fn.get(e), i || (i = {
            rel: "preload",
            as: "style",
            href: n.href,
            crossOrigin: n.crossOrigin,
            integrity: n.integrity,
            media: n.media,
            hrefLang: n.hrefLang,
            referrerPolicy: n.referrerPolicy
          }, Fn.set(e, i)), t1(
            u,
            e,
            i,
            s.state
          ))), t && l === null)
            throw Error(c(528, ""));
          return s;
        }
        if (t && l !== null)
          throw Error(c(529, ""));
        return null;
      case "script":
        return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = fi(n), t = $(
          u
        ).hoistableScripts, l = t.get(n), l || (l = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, t.set(n, l)), l) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(c(444, e));
    }
  }
  function si(e) {
    return 'href="' + yt(e) + '"';
  }
  function vr(e) {
    return 'link[rel="stylesheet"][' + e + "]";
  }
  function qm(e) {
    return L({}, e, {
      "data-precedence": e.precedence,
      precedence: null
    });
  }
  function t1(e, t, n, l) {
    if (t = e.querySelector(
      'link[rel="preload"][as="style"][' + t + "]"
    )) {
      if (t[Nu] !== !0) {
        l.loading = 1;
        return;
      }
    } else
      t = e.createElement("link"), t[Nu] = !0, t.onload = t.onerror = xe.bind(null, t), tn(t, "link", n), ee(t), e.head.appendChild(t);
    l.preload = t, t.addEventListener("load", function() {
      return l.loading |= 1;
    }), t.addEventListener("error", function() {
      return l.loading |= 2;
    });
  }
  function fi(e) {
    return '[src="' + yt(e) + '"]';
  }
  function gr(e) {
    return "script[async]" + e;
  }
  function Ym(e, t, n) {
    if (t.count++, t.instance === null)
      switch (t.type) {
        case "style":
          var l = e.querySelector(
            'style[data-href~="' + yt(n.href) + '"]'
          );
          if (l)
            return t.instance = l, ee(l), l;
          var u = L({}, n, {
            "data-href": n.href,
            "data-precedence": n.precedence,
            href: null,
            precedence: null
          });
          return l = (e.ownerDocument || e).createElement(
            "style"
          ), ee(l), tn(l, "style", u), ko(l, n.precedence, e), t.instance = l;
        case "stylesheet":
          u = si(n.href);
          var i = e.querySelector(
            vr(u)
          );
          if (i)
            return t.state.loading |= 4, t.instance = i, ee(i), i;
          l = qm(n), (u = Fn.get(u)) && If(l, u), i = (e.ownerDocument || e).createElement("link"), ee(i);
          var s = i;
          return s._p = new Promise(function(v, T) {
            s.onload = v, s.onerror = T;
          }), tn(i, "link", l), t.state.loading |= 4, ko(i, n.precedence, e), t.instance = i;
        case "script":
          return i = fi(n.src), (u = e.querySelector(
            gr(i)
          )) ? (t.instance = u, ee(u), u) : (l = n, (u = Fn.get(i)) && (l = L({}, n), Zf(l, u)), e = e.ownerDocument || e, u = e.createElement("script"), ee(u), tn(u, "link", l), e.head.appendChild(u), t.instance = u);
        case "void":
          return null;
        default:
          throw Error(c(443, t.type));
      }
    else
      t.type === "stylesheet" && (t.state.loading & 4) === 0 && (l = t.instance, t.state.loading |= 4, ko(l, n.precedence, e));
    return t.instance;
  }
  function ko(e, t, n) {
    for (var l = n.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), u = l.length ? l[l.length - 1] : null, i = u, s = 0; s < l.length; s++) {
      var v = l[s];
      if (v.dataset.precedence === t) i = v;
      else if (i !== u) break;
    }
    i ? i.parentNode.insertBefore(e, i.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
  }
  function If(e, t) {
    e.crossOrigin == null && (e.crossOrigin = t.crossOrigin), e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy), e.title == null && (e.title = t.title);
  }
  function Zf(e, t) {
    e.crossOrigin == null && (e.crossOrigin = t.crossOrigin), e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy), e.integrity == null && (e.integrity = t.integrity);
  }
  var Jo = null;
  function Gm(e, t, n) {
    if (Jo === null) {
      var l = /* @__PURE__ */ new Map(), u = Jo = /* @__PURE__ */ new Map();
      u.set(n, l);
    } else
      u = Jo, l = u.get(n), l || (l = /* @__PURE__ */ new Map(), u.set(n, l));
    if (l.has(e)) return l;
    for (l.set(e, null), n = n.getElementsByTagName(e), u = 0; u < n.length; u++) {
      var i = n[u];
      if (!(i[Ga] || i[Tt] || e === "link" && i.getAttribute("rel") === "stylesheet") && i.namespaceURI !== "http://www.w3.org/2000/svg") {
        var s = i.getAttribute(t) || "";
        s = e + s;
        var v = l.get(s);
        v ? v.push(i) : l.set(s, [i]);
      }
    }
    return l;
  }
  function kf(e, t, n) {
    e = e.ownerDocument || e, e.head.insertBefore(
      n,
      t === "title" ? e.querySelector("head > title") : null
    );
  }
  function n1(e, t, n) {
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
  function Xm(e, t) {
    return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
  }
  function Qm(e) {
    return !(e.type === "stylesheet" && (e.state.loading & 3) === 0);
  }
  function Km(e) {
    return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * 0.25;
  }
  function Im(e, t) {
    typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += Km(t), e.suspenseyImages.push(t)), e = u1.bind(e), t.decode().then(e, e));
  }
  function l1(e, t, n, l) {
    if (n.type === "stylesheet" && (typeof l.media != "string" || matchMedia(l.media).matches !== !1) && (n.state.loading & 4) === 0) {
      if (n.instance === null) {
        var u = si(l.href), i = t.querySelector(
          vr(u)
        );
        if (i) {
          t = i._p, t !== null && typeof t == "object" && typeof t.then == "function" && (e.count++, e = mr.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = i, ee(i);
          return;
        }
        i = t.ownerDocument || t, l = qm(l), (u = Fn.get(u)) && If(l, u), i = i.createElement("link"), ee(i);
        var s = i;
        s._p = new Promise(function(v, T) {
          s.onload = v, s.onerror = T;
        }), tn(i, "link", l), n.instance = i;
      }
      e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && (n.state.loading & 3) === 0 && (e.count++, n = mr.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
    }
  }
  var Fo = 0;
  function a1(e, t) {
    return e.stylesheets && e.count === 0 && Wo(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
      var l = setTimeout(function() {
        if (e.stylesheets && Wo(e, e.stylesheets), e.unsuspend) {
          var i = e.unsuspend;
          e.unsuspend = null, i();
        }
      }, 6e4 + t);
      0 < e.imgBytes && Fo === 0 && (Fo = 62500 * Tb());
      var u = setTimeout(
        function() {
          if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && Wo(e, e.stylesheets), e.unsuspend)) {
            var i = e.unsuspend;
            e.unsuspend = null, i();
          }
        },
        (e.imgBytes > Fo ? 50 : 800) + t
      );
      return e.unsuspend = n, function() {
        e.unsuspend = null, clearTimeout(l), clearTimeout(u);
      };
    } : null;
  }
  function Zm(e) {
    if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
      if (e.stylesheets) Wo(e, e.stylesheets);
      else if (e.unsuspend) {
        var t = e.unsuspend;
        e.unsuspend = null, t();
      }
    }
  }
  function mr() {
    this.count--, Zm(this);
  }
  function u1() {
    this.imgCount--, Zm(this);
  }
  var Po = null;
  function Wo(e, t) {
    e.stylesheets = null, e.unsuspend !== null && (e.count++, Po = /* @__PURE__ */ new Map(), t.forEach(i1, e), Po = null, mr.call(e));
  }
  function i1(e, t) {
    if (!(t.state.loading & 4)) {
      var n = Po.get(e);
      if (n) var l = n.get(null);
      else {
        n = /* @__PURE__ */ new Map(), Po.set(e, n);
        for (var u = e.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), i = 0; i < u.length; i++) {
          var s = u[i];
          (s.nodeName === "LINK" || s.getAttribute("media") !== "not all") && (n.set(s.dataset.precedence, s), l = s);
        }
        l && n.set(null, l);
      }
      u = t.instance, s = u.getAttribute("data-precedence"), i = n.get(s) || l, i === l && n.set(null, u), n.set(s, u), this.count++, l = mr.bind(this), u.addEventListener("load", l), u.addEventListener("error", l), i ? i.parentNode.insertBefore(u, i.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(u, e.firstChild)), t.state.loading |= 4;
    }
  }
  var di = {
    $$typeof: oe,
    Provider: null,
    Consumer: null,
    _currentValue: tt,
    _currentValue2: tt,
    _threadCount: 0
  };
  function r1(e, t, n, l, u, i, s, v, T) {
    this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = xu(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = xu(0), this.hiddenUpdates = xu(null), this.identifierPrefix = l, this.onUncaughtError = u, this.onCaughtError = i, this.onRecoverableError = s, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = T, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function km(e, t, n, l, u, i, s, v, T, w, X, J) {
    return e = new r1(
      e,
      t,
      n,
      s,
      T,
      w,
      X,
      J,
      v
    ), t = 1, i === !0 && (t |= 24), i = Sn(3, null, null, t), e.current = i, i.stateNode = e, t = os(), t.refCount++, e.pooledCache = t, t.refCount++, i.memoizedState = {
      element: l,
      isDehydrated: n,
      cache: t
    }, ds(i), e;
  }
  function Jm(e) {
    return e ? (e = Lu, e) : Lu;
  }
  function Fm(e, t, n, l, u, i) {
    u = Jm(u), l.context === null ? l.context = u : l.pendingContext = u, l = ha(t), l.payload = { element: n }, i = i === void 0 ? null : i, i !== null && (l.callback = i), n = pa(e, l, t), n !== null && (Cn(n, e, t), Ii(n, e, t));
  }
  function Pm(e, t) {
    if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
      var n = e.retryLane;
      e.retryLane = n !== 0 && n < t ? n : t;
    }
  }
  function Jf(e, t) {
    Pm(e, t), (e = e.alternate) && Pm(e, t);
  }
  function Wm(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = Pa(e, 67108864);
      t !== null && Cn(t, e, 67108864), Jf(e, 67108864);
    }
  }
  function $m(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = Hn();
      t = aa(t);
      var n = Pa(e, t);
      n !== null && Cn(n, e, t), Jf(e, t);
    }
  }
  var vi = !0;
  function o1(e, t, n, l) {
    var u = se.T;
    se.T = null;
    var i = ve.p;
    try {
      ve.p = 2, Ff(e, t, n, l);
    } finally {
      ve.p = i, se.T = u;
    }
  }
  function c1(e, t, n, l) {
    var u = se.T;
    se.T = null;
    var i = ve.p;
    try {
      ve.p = 8, Ff(e, t, n, l);
    } finally {
      ve.p = i, se.T = u;
    }
  }
  function Ff(e, t, n, l) {
    if (vi) {
      var u = Pf(l);
      if (u === null)
        Df(
          e,
          t,
          l,
          $o,
          n
        ), th(e, l);
      else if (f1(
        u,
        e,
        t,
        n,
        l
      ))
        l.stopPropagation();
      else if (th(e, l), t & 4 && -1 < s1.indexOf(e)) {
        for (; u !== null; ) {
          var i = Xa(u);
          if (i !== null)
            switch (i.tag) {
              case 3:
                if (i = i.stateNode, i.current.memoizedState.isDehydrated) {
                  var s = _l(i.pendingLanes);
                  if (s !== 0) {
                    var v = i;
                    for (v.pendingLanes |= 2, v.entangledLanes |= 2; s; ) {
                      var T = 1 << 31 - Gt(s);
                      v.entanglements[1] |= T, s &= ~T;
                    }
                    Rl(i), (lt & 6) === 0 && (Lo = Zt() + 500, or(0));
                  }
                }
                break;
              case 31:
              case 13:
                v = Pa(i, 2), v !== null && Cn(v, i, 2), Yo(), Jf(i, 2);
            }
          if (i = Pf(l), i === null && Df(
            e,
            t,
            l,
            $o,
            n
          ), i === u) break;
          u = i;
        }
        u !== null && l.stopPropagation();
      } else
        Df(
          e,
          t,
          l,
          null,
          n
        );
    }
  }
  function Pf(e) {
    return e = Ia(e), Wf(e);
  }
  var $o = null;
  function Wf(e) {
    if ($o = null, e = ul(e), e !== null) {
      var t = d(e);
      if (t === null) e = null;
      else {
        var n = t.tag;
        if (n === 13) {
          if (e = m(t), e !== null) return e;
          e = null;
        } else if (n === 31) {
          if (e = p(t), e !== null) return e;
          e = null;
        } else if (n === 3) {
          if (t.stateNode.current.memoizedState.isDehydrated)
            return t.tag === 3 ? t.stateNode.containerInfo : null;
          e = null;
        } else t !== e && (e = null);
      }
    }
    return $o = e, null;
  }
  function eh(e) {
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
        switch (Eu()) {
          case gl:
            return 2;
          case Tu:
            return 8;
          case yn:
          case Br:
            return 32;
          case Ri:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var $f = !1, za = null, Ma = null, Da = null, hr = /* @__PURE__ */ new Map(), pr = /* @__PURE__ */ new Map(), _a = [], s1 = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function th(e, t) {
    switch (e) {
      case "focusin":
      case "focusout":
        za = null;
        break;
      case "dragenter":
      case "dragleave":
        Ma = null;
        break;
      case "mouseover":
      case "mouseout":
        Da = null;
        break;
      case "pointerover":
      case "pointerout":
        hr.delete(t.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        pr.delete(t.pointerId);
    }
  }
  function yr(e, t, n, l, u, i) {
    return e === null || e.nativeEvent !== i ? (e = {
      blockedOn: t,
      domEventName: n,
      eventSystemFlags: l,
      nativeEvent: i,
      targetContainers: [u]
    }, t !== null && (t = Xa(t), t !== null && Wm(t)), e) : (e.eventSystemFlags |= l, t = e.targetContainers, u !== null && t.indexOf(u) === -1 && t.push(u), e);
  }
  function f1(e, t, n, l, u) {
    switch (t) {
      case "focusin":
        return za = yr(
          za,
          e,
          t,
          n,
          l,
          u
        ), !0;
      case "dragenter":
        return Ma = yr(
          Ma,
          e,
          t,
          n,
          l,
          u
        ), !0;
      case "mouseover":
        return Da = yr(
          Da,
          e,
          t,
          n,
          l,
          u
        ), !0;
      case "pointerover":
        var i = u.pointerId;
        return hr.set(
          i,
          yr(
            hr.get(i) || null,
            e,
            t,
            n,
            l,
            u
          )
        ), !0;
      case "gotpointercapture":
        return i = u.pointerId, pr.set(
          i,
          yr(
            pr.get(i) || null,
            e,
            t,
            n,
            l,
            u
          )
        ), !0;
    }
    return !1;
  }
  function nh(e) {
    var t = ul(e.target);
    if (t !== null) {
      var n = d(t);
      if (n !== null) {
        if (t = n.tag, t === 13) {
          if (t = m(n), t !== null) {
            e.blockedOn = t, Ya(e.priority, function() {
              $m(n);
            });
            return;
          }
        } else if (t === 31) {
          if (t = p(n), t !== null) {
            e.blockedOn = t, Ya(e.priority, function() {
              $m(n);
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
  function ec(e) {
    if (e.blockedOn !== null) return !1;
    for (var t = e.targetContainers; 0 < t.length; ) {
      var n = Pf(e.nativeEvent);
      if (n === null) {
        n = e.nativeEvent;
        var l = new n.constructor(
          n.type,
          n
        );
        Ka = l, n.target.dispatchEvent(l), Ka = null;
      } else
        return t = Xa(n), t !== null && Wm(t), e.blockedOn = n, !1;
      t.shift();
    }
    return !0;
  }
  function lh(e, t, n) {
    ec(e) && n.delete(t);
  }
  function d1() {
    $f = !1, za !== null && ec(za) && (za = null), Ma !== null && ec(Ma) && (Ma = null), Da !== null && ec(Da) && (Da = null), hr.forEach(lh), pr.forEach(lh);
  }
  function tc(e, t) {
    e.blockedOn === t && (e.blockedOn = null, $f || ($f = !0, a.unstable_scheduleCallback(
      a.unstable_NormalPriority,
      d1
    )));
  }
  var nc = null;
  function ah(e) {
    nc !== e && (nc = e, a.unstable_scheduleCallback(
      a.unstable_NormalPriority,
      function() {
        nc === e && (nc = null);
        for (var t = 0; t < e.length; t += 3) {
          var n = e[t], l = e[t + 1], u = e[t + 2];
          if (typeof l != "function") {
            if (Wf(l || n) === null)
              continue;
            break;
          }
          var i = Xa(n);
          i !== null && (e.splice(t, 3), t -= 3, ws(
            i,
            {
              pending: !0,
              data: u,
              method: n.method,
              action: l
            },
            l,
            u
          ));
        }
      }
    ));
  }
  function gi(e) {
    function t(T) {
      return tc(T, e);
    }
    za !== null && tc(za, e), Ma !== null && tc(Ma, e), Da !== null && tc(Da, e), hr.forEach(t), pr.forEach(t);
    for (var n = 0; n < _a.length; n++) {
      var l = _a[n];
      l.blockedOn === e && (l.blockedOn = null);
    }
    for (; 0 < _a.length && (n = _a[0], n.blockedOn === null); )
      nh(n), n.blockedOn === null && _a.shift();
    if (n = (e.ownerDocument || e).$$reactFormReplay, n != null)
      for (l = 0; l < n.length; l += 3) {
        var u = n[l], i = n[l + 1], s = u[kt] || null;
        if (typeof i == "function")
          s || ah(n);
        else if (s) {
          var v = null;
          if (i && i.hasAttribute("formAction")) {
            if (u = i, s = i[kt] || null)
              v = s.formAction;
            else if (Wf(u) !== null) continue;
          } else v = s.action;
          typeof v == "function" ? n[l + 1] = v : (n.splice(l, 3), l -= 3), ah(n);
        }
      }
  }
  function uh() {
    function e(i) {
      i.canIntercept && i.info === "react-transition" && i.intercept({
        handler: function() {
          return new Promise(function(s) {
            return u = s;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function t() {
      u !== null && (u(), u = null), l || setTimeout(n, 20);
    }
    function n() {
      if (!l && !navigation.transition) {
        var i = navigation.currentEntry;
        i && i.url != null && navigation.navigate(i.url, {
          state: i.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var l = !1, u = null;
      return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
        l = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), u !== null && (u(), u = null);
      };
    }
  }
  function ed(e) {
    this._internalRoot = e;
  }
  lc.prototype.render = ed.prototype.render = function(e) {
    var t = this._internalRoot;
    if (t === null) throw Error(c(409));
    var n = t.current, l = Hn();
    Fm(n, l, e, t, null, null);
  }, lc.prototype.unmount = ed.prototype.unmount = function() {
    var e = this._internalRoot;
    if (e !== null) {
      this._internalRoot = null;
      var t = e.containerInfo;
      Fm(e.current, 2, null, e, null, null), Yo(), t[An] = null;
    }
  };
  function lc(e) {
    this._internalRoot = e;
  }
  lc.prototype.unstable_scheduleHydration = function(e) {
    if (e) {
      var t = Yn();
      e = { blockedOn: null, target: e, priority: t };
      for (var n = 0; n < _a.length && t !== 0 && t < _a[n].priority; n++) ;
      _a.splice(n, 0, e), n === 0 && nh(e);
    }
  };
  var ih = r.version;
  if (ih !== "19.3.0")
    throw Error(
      c(
        527,
        ih,
        "19.3.0"
      )
    );
  ve.findDOMNode = function(e) {
    var t = e._reactInternals;
    if (t === void 0)
      throw typeof e.render == "function" ? Error(c(188)) : (e = Object.keys(e).join(","), Error(c(268, e)));
    return e = y(t), e = e !== null ? b(e) : null, e = e === null ? null : e.stateNode, e;
  };
  var v1 = {
    bundleType: 0,
    version: "19.3.0",
    rendererPackageName: "react-dom",
    currentDispatcherRef: se,
    reconcilerVersion: "19.3.0"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var ac = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!ac.isDisabled && ac.supportsFiber)
      try {
        $l = ac.inject(
          v1
        ), un = ac;
      } catch {
      }
  }
  return Sr.createRoot = function(e, t) {
    if (!f(e)) throw Error(c(299));
    var n = !1, l = "", u = Jv, i = Fv, s = Pv;
    return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (l = t.identifierPrefix), t.onUncaughtError !== void 0 && (u = t.onUncaughtError), t.onCaughtError !== void 0 && (i = t.onCaughtError), t.onRecoverableError !== void 0 && (s = t.onRecoverableError)), t = km(
      e,
      1,
      !1,
      null,
      null,
      n,
      l,
      null,
      u,
      i,
      s,
      uh
    ), e[An] = t.current, Mf(e), new ed(t);
  }, Sr.hydrateRoot = function(e, t, n) {
    if (!f(e)) throw Error(c(299));
    var l = !1, u = "", i = Jv, s = Fv, v = Pv, T = null;
    return n != null && (n.unstable_strictMode === !0 && (l = !0), n.identifierPrefix !== void 0 && (u = n.identifierPrefix), n.onUncaughtError !== void 0 && (i = n.onUncaughtError), n.onCaughtError !== void 0 && (s = n.onCaughtError), n.onRecoverableError !== void 0 && (v = n.onRecoverableError), n.formState !== void 0 && (T = n.formState)), t = km(
      e,
      1,
      !0,
      t,
      n ?? null,
      l,
      u,
      T,
      i,
      s,
      v,
      uh
    ), t.context = Jm(null), n = t.current, l = Hn(), l = aa(l), u = ha(l), u.callback = null, pa(n, u, l), n = l, t.current.lanes = n, wl(t, n), Rl(t), e[An] = t.current, Mf(e), new lc(t);
  }, Sr.version = "19.3.0", Sr;
}
var hh;
function _1() {
  if (hh) return ld.exports;
  hh = 1;
  function a() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(a);
      } catch (r) {
        console.error(r);
      }
  }
  return a(), ld.exports = D1(), ld.exports;
}
var w1 = _1(), _r = f2();
const d2 = 48, zl = (a, r = 0) => {
  const o = new Int32Array(a.length);
  for (let c = 0; c < a.length; c++) o[c] = a.charCodeAt(c) - d2 - r;
  return o;
}, xc = (a) => {
  const r = new Int32Array(a.length + 1);
  for (let o = 0; o < a.length; o++) r[o + 1] = r[o] + a[o];
  return r;
}, Ha = (a) => {
  const r = new Int32Array(a.length);
  let o = 0;
  for (let c = 0; c < a.length; c++) {
    const f = a.charCodeAt(c) - d2;
    o += f >>> 1 ^ -(f & 1), r[c] = o;
  }
  return r;
}, j1 = 384, U1 = [], pu = xc(zl("E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010")), H1 = xc(zl(":11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3")), B1 = "@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom", L1 = (() => {
  const a = pu.length - 1, r = new Int32Array(a);
  for (let f = a - 1; f >= 0; f--) {
    let d = 1, m = f + 1;
    for (let p = pu[f]; p < pu[f + 1]; p++)
      d += r[m], m += r[m];
    r[f] = d;
  }
  const o = new Int32Array(pu[a]);
  let c = 0;
  for (let f = 0; f < a; f++) {
    let d = f + 1;
    for (let m = pu[f]; m < pu[f + 1]; m++)
      o[c++] = d, d += r[d];
  }
  return o;
})(), V1 = zl("02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000", 1), q1 = xc(zl("123333359346463635126536711576")), Y1 = zl("93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032"), G1 = zl("012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199"), X1 = Ha("020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200"), Q1 = (() => {
  const a = (/* @__PURE__ */ new Int32Array(319)).fill(-1), r = Ha("02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222"), o = Ha("02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222");
  for (let c = 0; c < r.length; c++) a[r[c]] = o[c];
  return a;
})(), K1 = "container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover| gradient-to-b gradient-to-bl gradient-to-br gradient-to-l gradient-to-r gradient-to-t gradient-to-tl gradient-to-tr none|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform".split("|").map((a) => {
  const r = a.split(" "), o = r.shift();
  for (let c = 0; c < r.length; c++) r[c] = o + r[c];
  return r;
}), ph = Ha("0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422"), I1 = Ha("ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>ʶ22ʷʺʷ2ʸʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622"), Z1 = Ha("02222222222222222222222222222222222222222222222222222222222222222202022222222222EH2200IL021042222Y\\222IL0cf2e10j2222U00X202[^2y0000120|{~22:22|22222222222G000qOVI00000}2>40000B00000I¨©000¬00000000000000021M®­00°000000000000000000000222HGHa1º222¿2À2222ÉÌ000­°2±"), v2 = /* @__PURE__ */ new Int32Array(995), g2 = /* @__PURE__ */ new Int32Array(995), m2 = /* @__PURE__ */ new Int32Array(995);
let Cd = "";
const Rd = /* @__PURE__ */ new Int32Array(1038);
{
  const a = /* @__PURE__ */ new Map();
  let r = 0, o = 0;
  for (let c = 0; c < ph.length; c++) for (const f of K1[Z1[c]]) {
    let d = a.get(f);
    d === void 0 && (d = r++, a.set(f, d), Rd[d * 2] = Cd.length, Rd[d * 2 + 1] = f.length, Cd += f), v2[o] = ph[c], g2[o] = I1[c], m2[o] = d, o++;
  }
}
const k1 = Ha("0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p"), J1 = xc(zl("1::24444432:442:44:44>222222:44:4421322511111311111114")), F1 = Ha("24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222"), P1 = zl("ĳ"), W1 = zl(""), $1 = zl("1"), eS = "* ** after backdrop before details-content file first-letter first-line marker placeholder selection";
var tS = {
  GROUP_COUNT: j1,
  customValidatorNames: U1,
  edgeStart: pu,
  labelStart: H1,
  labelText: B1,
  edgeTarget: L1,
  nodeGroup: V1,
  nodeVlist: Q1,
  vlistPat: q1,
  vlistOps: Y1,
  vlistRef: G1,
  vlistGroup: X1,
  litAnchor: v2,
  litGroup: g2,
  litPool: m2,
  poolOffsets: Rd,
  poolText: Cd,
  adjGid: k1,
  adjStart: J1,
  adjTgt: F1,
  patGid: P1,
  patTgt: W1,
  postfixLookupGroups: $1,
  orderSensitiveModifiers: eS
};
const nS = "line" in /* @__PURE__ */ new Error(), Al = -1, mu = -1, rd = (a, r, o) => {
  let c = 2166136261;
  for (let f = r; f < o; f++) c = Math.imul(c ^ a.charCodeAt(f), 16777619);
  return c;
}, vc = (a, r, o) => {
  const c = o - r;
  let f = Math.imul(c, 2654435761) ^ a.charCodeAt(r);
  if (c > 3) {
    const d = c >> 2, m = c >> 1;
    f = Math.imul(f ^ a.charCodeAt(r + 1) << 8 ^ a.charCodeAt(r + 2) << 16 ^ a.charCodeAt(r + d), 2246822507), f = Math.imul(f ^ a.charCodeAt(r + m) << 8 ^ a.charCodeAt(r + m + d) << 16 ^ a.charCodeAt(o - 3), 3266489909), f ^= a.charCodeAt(o - 2) << 8 ^ a.charCodeAt(o - 1) << 16;
    for (let p = r + 3, h = o - 4; p < r + 8 && p < h; p++, h--) f = Math.imul(f ^ a.charCodeAt(p) ^ a.charCodeAt(h) << 8, 16777619);
  }
  return f ^ f >>> 15 | 0;
}, lS = (a, r, o = {}) => {
  const { GROUP_COUNT: c, edgeStart: f, labelStart: d, labelText: m, edgeTarget: p, nodeGroup: h, nodeVlist: y, vlistPat: b, vlistOps: g, vlistRef: x, vlistGroup: q, litAnchor: j, litGroup: Y, litPool: _, poolOffsets: R, poolText: M, adjGid: F, adjStart: A, adjTgt: N, patGid: Q, patTgt: L, postfixLookupGroups: V, customValidatorNames: P, orderSensitiveModifiers: Z } = a, K = new Int32Array(c).fill(-1);
  for (let G = 0; G < F.length; G++) K[F[G]] = G;
  let te = 0;
  for (let G = 0; G + 1 < A.length; G++) {
    const $ = A[G + 1] - A[G];
    $ > te && (te = $);
  }
  let fe = 32;
  for (; fe < 2 * (1 + te + Q.length); ) fe <<= 1;
  const ae = new Int32Array(x.length + 1);
  for (let G = 0; G < x.length; G++) ae[G + 1] = ae[G] + b[x[G] + 1] - b[x[G]];
  const oe = new Uint8Array(c);
  for (let G = 0; G < V.length; G++) oe[V[G]] = 1;
  const I = f.length - 1, ce = new Uint8Array(I);
  let ne = 0, ie = !0;
  for (let G = 0; G < j.length; G++) {
    ce[j[G]] = 1;
    const $ = R[_[G] * 2 + 1];
    $ > ne && (ne = $);
    const ee = M.charCodeAt(R[_[G] * 2]);
    (ee === 91 || ee === 40) && (ie = !1);
  }
  let W = 1;
  for (; W < j.length * 2; ) W <<= 1;
  const ze = new Int32Array(W).fill(-1);
  for (let G = 0; G < j.length; G++) {
    const $ = R[_[G] * 2];
    let ee = (rd(M, $, $ + R[_[G] * 2 + 1]) ^ Math.imul(j[G], 2654435761) | 0) & W - 1;
    for (; ze[ee] !== -1; ) ee = ee + 1 & W - 1;
    ze[ee] = G;
  }
  const pe = (G, $, ee, xe) => {
    let Le = (rd($, ee, xe) ^ Math.imul(G, 2654435761) | 0) & W - 1;
    const Ue = xe - ee;
    for (; ; ) {
      const Qe = ze[Le];
      if (Qe === -1) return -1;
      if (j[Qe] === G && R[_[Qe] * 2 + 1] === Ue) {
        const dt = R[_[Qe] * 2];
        let ut = !0;
        for (let Me = 0; Me < Ue; Me++) if (M.charCodeAt(dt + Me) !== $.charCodeAt(ee + Me)) {
          ut = !1;
          break;
        }
        if (ut) return Y[Qe];
      }
      Le = Le + 1 & W - 1;
    }
  }, De = o.cacheSize ?? 8192, E = o.prefix ?? a.prefix ?? "", U = E === "" ? "" : E + ":", le = U.length, re = (P ?? []).map((G) => {
    throw new Error("cn: missing validator " + G);
  }), me = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, ue = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/, ye = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, se = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  let ve = 0, tt = -1, je = -1, Xe = -1, be = -1;
  const _e = (G) => G >= 97 && G <= 122 || G >= 65 && G <= 90 || G >= 48 && G <= 57 || G === 95, Be = (G) => /\s/.test(String.fromCharCode(G)), Te = (G, $, ee) => {
    if (ve = 0, tt = -1, ee - $ < 3) return;
    const xe = G.charCodeAt($), Le = G.charCodeAt(ee - 1);
    if (xe === 91 && Le === 93) ve = 1;
    else if (xe === 40 && Le === 41) ve = 2;
    else return;
    Xe = $ + 1, be = ee - 1;
    let Ue = $ + 1;
    if (_e(G.charCodeAt(Ue))) {
      for (Ue++; Ue < ee - 1; ) {
        const Qe = G.charCodeAt(Ue);
        if (!_e(Qe) && Qe !== 45) break;
        Ue++;
      }
      Ue < ee - 2 && G.charCodeAt(Ue) === 58 && (tt = $ + 1, je = Ue, Xe = Ue + 1);
    }
  }, Ie = (G, $, ee, xe) => {
    if (ee - $ !== xe.length) return !1;
    for (let Le = 0; Le < xe.length; Le++) if (G.charCodeAt($ + Le) !== xe.charCodeAt(Le)) return !1;
    return !0;
  }, Re = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, at = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, qe = (G) => !!G && !Number.isNaN(Number(G)), ft = (G, $, ee) => {
    if (ee - $ < 11 || !Ie(G, $, $ + 10, "@container")) return !1;
    if (G.charCodeAt($ + 10) === 47) return ee - $ >= 12;
    const xe = G.charCodeAt($ + 11);
    return xe === 115 && ee - $ >= 17 && Ie(G, $ + 10, $ + 16, "-size/") || xe === 110 && ee - $ >= 19 && Ie(G, $ + 10, $ + 18, "-normal/");
  }, ge = [
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
  ], Se = "length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight".split("|").map((G) => G.split(" ")), St = [
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
  ], Et = (G, $, ee, xe) => {
    if (G >= 10) {
      if (G >= 25) return re[G - 25]($.slice(ee, xe));
      const Le = G - 10;
      if (ve !== ge[Le]) return !1;
      if (tt >= 0) {
        for (const Ue of Se[Le]) if (Ie($, tt, je, Ue)) return !0;
        return !1;
      }
      switch (St[Le]) {
        case 0:
          return !1;
        case 1:
          return !0;
        case 2: {
          const Ue = $.slice(Xe, be);
          return me.test(Ue) && !ue.test(Ue);
        }
        case 3:
          return qe($.slice(Xe, be));
        case 4:
          return se.test($.slice(Xe, be));
        default:
          return ye.test($.slice(Xe, be));
      }
    }
    switch (G) {
      case 0:
        return !0;
      case 1:
        return ve === 0;
      case 2:
        return ve === 1;
      case 3:
        return ve === 2;
      case 4:
        return Re.test($.slice(ee, xe));
      case 5:
        return qe($.slice(ee, xe));
      case 6: {
        const Le = $.slice(ee, xe);
        return !!Le && Number.isInteger(Number(Le));
      }
      case 7:
        return xe > ee && $.charCodeAt(xe - 1) === 37 && qe($.slice(ee, xe - 1));
      case 8:
        return at.test($.slice(ee, xe));
      default:
        return ft($, ee, xe);
    }
  }, nt = new Set(typeof Z == "string" ? Z.split(" ") : Z), Rn = (G, $, ee, xe, Le, Ue) => {
    const Qe = rd($, ee, xe) ^ (Le ? 2654435769 : 0) | 0;
    let dt = G.get(Qe);
    if (dt !== void 0) e: for (let Ve = 0; Ve < dt.length; Ve++) {
      const et = dt[Ve];
      if (!(et.imp !== Le || et.k.length !== xe - ee)) {
        for (let Ne = 0; Ne < et.k.length; Ne++) if (et.k.charCodeAt(Ne) !== $.charCodeAt(ee + Ne)) continue e;
        return et.id;
      }
    }
    else G.set(Qe, dt = []);
    const ut = $.slice(ee, xe), Me = Ue(ut);
    return dt.push({
      k: ut,
      imp: Le,
      id: Me
    }), Me;
  };
  let ln = /* @__PURE__ */ new Map(), an = /* @__PURE__ */ new Map(), $n = 2;
  const Ml = 4096, Va = (G, $) => {
    const ee = [];
    let xe = 0, Le = 0, Ue = 0;
    for (let Me = 0; Me < G.length; Me++) {
      const Ve = G.charCodeAt(Me);
      xe === 0 && Le === 0 && Ve === 58 ? (ee.push(G.slice(Ue, Me)), Ue = Me + 1) : Ve === 91 ? xe++ : Ve === 93 ? xe-- : Ve === 40 ? Le++ : Ve === 41 && Le--;
    }
    ee.push(G.slice(Ue));
    let Qe = ee[0];
    if (ee.length > 1) {
      const Me = [];
      let Ve = [];
      for (const et of ee) et.charCodeAt(0) === 91 || nt.has(et) ? (Ve.length && (Me.push(...Ve.sort()), Ve = []), Me.push(et)) : Ve.push(et);
      Ve.length && Me.push(...Ve.sort()), Qe = Me.join(":");
    }
    const dt = $ ? Qe + " !" : Qe;
    let ut = an.get(dt);
    return ut === void 0 && an.set(dt, ut = $n++), ut;
  };
  let Pl = /* @__PURE__ */ new Map(), Wl = c;
  const Ci = c + 4096, Zt = () => Wl++, Eu = 2097152, gl = 8192, Tu = new Int32Array(gl), yn = new Array(gl).fill(null), Br = new Int32Array(gl), Ri = new Int32Array(gl), Lr = new Uint8Array(gl);
  let Vr = 0;
  const $l = (G, $, ee, xe, Le, Ue, Qe, dt) => {
    let ut = G;
    if (yn[G] !== null)
      if (yn[G | 1] === null) ut = G | 1;
      else if ((Vr++ & 3) === 0) ut = G | Vr >> 2 & 1;
      else return;
    yn[ut] = $.slice(ee, xe), Tu[ut] = Le, Br[ut] = Ue, Ri[ut] = Qe, Lr[ut] = dt;
  }, un = () => yn.fill(null);
  let _t = 256, Gt = [
    new Int32Array(_t),
    new Int32Array(_t),
    new Int32Array(_t),
    new Int32Array(_t)
  ], [ea, ta, na, Dl] = Gt, ml = new Uint8Array(_t), el = new Uint8Array(_t);
  const _l = () => {
    _t *= 2, Gt = Gt.map(($) => {
      const ee = new Int32Array(_t);
      return ee.set($), ee;
    }), [ea, ta, na, Dl] = Gt;
    const G = new Uint8Array(_t);
    G.set(ml), ml = G, el = new Uint8Array(_t);
  };
  let tl = 64, nl = new Int32Array(tl), la = new Int32Array(tl);
  const Ai = new Int32Array(c);
  let ll = 2048, xu = 21, wl = new Float64Array(ll), Cu = new Int32Array(ll), al = 0;
  const Ru = (G, $) => {
    if (G === 0 && $ < c)
      return Ai[$] === al ? 1 : (Ai[$] = al, 0);
    const ee = G * 2097152 + $ + 1;
    let xe = Math.imul(ee, 2654435761) >>> xu;
    for (; Cu[xe] === al; ) {
      if (wl[xe] === ee) return 1;
      xe = xe + 1 & ll - 1;
    }
    return wl[xe] = ee, Cu[xe] = al, 0;
  }, qa = (G, $, ee, xe, Le) => {
    if (ee - $ >= 2 && G.charCodeAt($) === 91 && G.charCodeAt(ee - 1) === 93) {
      let Ue = -1;
      for (let Qe = $ + 1; Qe < ee - 1; Qe++) if (G.charCodeAt(Qe) === 58) {
        Ue = Qe;
        break;
      }
      return Ue === -1 || Ue === $ + 1 ? Al : Rn(Pl, G, $ + 1, Ue, 0, Zt);
    }
    if (xe >= 0 && h[xe] >= 0) return h[xe];
    for (let Ue = Le - 1; Ue >= 0; Ue--) {
      const Qe = la[Ue];
      if (Qe > ee) continue;
      const dt = nl[Ue], ut = ee - Qe;
      if (ce[dt] === 1 && ut > 0 && ut <= ne) {
        const xt = G.charCodeAt(Qe);
        if (ie === !1 || xt !== 91 && xt !== 40) {
          const On = pe(dt, G, Qe, ee);
          if (On >= 0) return On;
        }
      }
      const Me = y[dt];
      if (Me < 0) continue;
      const Ve = x[Me], et = b[Ve], Ne = b[Ve + 1];
      if (et === Ne) continue;
      Te(G, Qe, ee);
      const Vt = ae[Me] - et;
      for (let xt = et; xt < Ne; xt++) if (Et(g[xt], G, Qe, ee)) return q[Vt + xt];
    }
    return Al;
  }, aa = (G) => {
    const $ = G.length;
    let ee = 0, xe = 0, Le = !1;
    ($n > Ml || ln.size > Ml) && (ln = /* @__PURE__ */ new Map(), an = /* @__PURE__ */ new Map(), $n = 2, un()), Wl > Ci && (Pl = /* @__PURE__ */ new Map(), Wl = c, un());
    let Ue = 0;
    for (; Ue < $; ) {
      let Me = G.charCodeAt(Ue);
      if (Me === 32 || Me >= 9 && Me <= 13 || Me >= 160 && Be(Me)) {
        Me !== 32 && (Le = !0), Ue++;
        continue;
      }
      const Ve = Ue;
      let et = 0;
      for (; Ue < $; ) {
        if (Me = G.charCodeAt(Ue), Me <= 32) {
          if (Me === 32) break;
          if (Me >= 9 && Me <= 13) {
            Le = !0;
            break;
          }
        } else if (Me >= 160 && Be(Me)) {
          Le = !0;
          break;
        }
        et = Math.imul(et ^ Me, 16777619), Ue++;
      }
      const Ne = Ue, Vt = Ne - Ve;
      ee === _t && _l();
      const xt = ee++;
      ea[xt] = Ve, ta[xt] = Ne, xe += Vt, et ^= Math.imul(Vt, 2654435761);
      const On = et ^ et >>> 15 | 0, wt = On & 8190;
      {
        let We = -1;
        if (Tu[wt] === On && yn[wt] !== null && yn[wt].length === Vt ? We = wt : Tu[wt | 1] === On && yn[wt | 1] !== null && yn[wt | 1].length === Vt && (We = wt | 1), We >= 0) {
          const Xt = yn[We];
          let Gn = !0;
          for (let Mn = 0; Mn < Vt; Mn++) if (Xt.charCodeAt(Mn) !== G.charCodeAt(Ve + Mn)) {
            Gn = !1;
            break;
          }
          if (Gn) {
            na[xt] = Br[We], Dl[xt] = Ri[We], ml[xt] = Lr[We];
            continue;
          }
        }
      }
      let jt = Ve;
      if (le !== 0) {
        if (Ne - Ve <= le || !G.startsWith(U, Ve)) {
          na[xt] = Al, $l(wt, G, Ve, Ne, On, Al, 0, 0);
          continue;
        }
        jt = Ve + le;
      }
      let Mu = 0, Ni = 0, jl = -1, Du = -1;
      for (let We = jt; We < Ne; We++) {
        const Xt = G.charCodeAt(We);
        if (Mu === 0 && Ni === 0) {
          if (Xt === 58) {
            jl = We;
            continue;
          }
          if (Xt === 47) {
            Du = We;
            continue;
          }
        }
        Xt === 91 ? Mu++ : Xt === 93 ? Mu-- : Xt === 40 ? Ni++ : Xt === 41 && Ni--;
      }
      const qr = jl >= jt ? jl + 1 : jt;
      let yt = qr, rn = Ne, ia = !1, _u = 0;
      rn > yt && G.charCodeAt(rn - 1) === 33 ? (ia = !0, rn--) : rn > yt && G.charCodeAt(yt) === 33 && (ia = !0, yt++, _u = 1);
      let bn = -1;
      Du > qr && (bn = Du + _u, bn >= rn && (bn = -1));
      let wu = yt;
      rn - yt > 1 && G.charCodeAt(yt) === 45 && (wu = yt + 1);
      let Nn = 0, fn = 0, ra = 0, zi = -1, zn = 0;
      (y[0] >= 0 || ce[0] === 1) && (nl[0] = 0, la[0] = wu, zn = 1);
      let Qa = mu, Mi = 0;
      for (let We = wu; We < rn; We++)
        if (We === bn && (Qa = fn < ra ? mu : Nn, Mi = zn), Nn !== mu) {
          const Xt = G.charCodeAt(We);
          let Gn = -1;
          if (fn < ra)
            m.charCodeAt(fn) === Xt ? (fn++, fn === ra && (Gn = Nn = zi)) : Nn = mu;
          else {
            const Mn = f[Nn], Za = f[Nn + 1];
            let Ul = mu;
            for (let Ft = Mn; Ft < Za; Ft++) {
              const ka = d[Ft];
              if (m.charCodeAt(ka) === Xt) {
                d[Ft + 1] - ka === 1 ? Gn = Ul = p[Ft] : (fn = ka + 1, ra = d[Ft + 1], zi = p[Ft], Ul = Nn);
                break;
              }
            }
            Nn = Ul;
          }
          if (Gn >= 0 && (y[Gn] >= 0 || ce[Gn] === 1) && We + 1 < rn && G.charCodeAt(We + 1) === 45) {
            if (zn === tl) {
              tl *= 2;
              const Mn = new Int32Array(tl);
              Mn.set(nl), nl = Mn;
              const Za = new Int32Array(tl);
              Za.set(la), la = Za;
            }
            nl[zn] = Gn, la[zn] = We + 2, zn++;
          }
        }
      bn === rn && (Qa = fn < ra ? mu : Nn, Mi = zn);
      const Di = fn < ra ? mu : Nn;
      let Jt, dn = !1;
      if (bn >= 0)
        if (dn = !0, Jt = qa(G, yt, bn, Qa, Mi), Jt !== Al && Jt < c && oe[Jt]) {
          const We = qa(G, yt, rn, Di, zn);
          We !== Al && We !== Jt && (Jt = We, dn = !1);
        } else Jt === Al && (Jt = qa(G, yt, rn, Di, zn), dn = !1);
      else Jt = qa(G, yt, rn, Di, zn);
      let Ka = 0, Ia = 0;
      Jt === Al ? na[xt] = Al : (Ia = dn ? 1 : 0, Ka = jt >= jl ? ia ? 1 : 0 : Rn(ln, G, jt, jl, ia ? 1 : 0, (We) => Va(We, ia)), na[xt] = Jt, ml[xt] = Ia, Dl[xt] = Ka), $l(wt, G, Ve, Ne, On, Jt, Ka, Ia);
    }
    if (ee === 0) return "";
    if (ee === 1) return ea[0] === 0 && ta[0] === $ ? G : G.slice(ea[0], ta[0]);
    if (ee * fe > ll) {
      for (; ee * fe > ll; )
        ll <<= 1, xu--;
      wl = new Float64Array(ll), Cu = new Int32Array(ll);
    }
    if ($n >= Eu || Wl >= Eu) throw new Error("cn: too many distinct classes in one merge");
    al = al + 1 | 0, al === 0 && (Ai.fill(0), Cu.fill(0), al = 1);
    let Qe = !1;
    for (let Me = ee - 1; Me >= 0; Me--) {
      const Ve = na[Me];
      if (Ve === Al) {
        el[Me] = 1;
        continue;
      }
      const et = Dl[Me];
      if (Ru(et, Ve) === 1) {
        el[Me] = 0, Qe = !0;
        continue;
      }
      if (el[Me] = 1, Ve < c) {
        const Ne = K[Ve];
        if (Ne >= 0) for (let Vt = A[Ne]; Vt < A[Ne + 1]; Vt++) Ru(et, N[Vt]);
        if (ml[Me] & 1)
          for (let Vt = 0; Vt < Q.length; Vt++) Q[Vt] === Ve && Ru(et, L[Vt]);
      }
    }
    if (!Qe && !Le && $ === xe + ee - 1) return G;
    let dt = "", ut = 0;
    for (; ut < ee; ) {
      if (!el[ut]) {
        ut++;
        continue;
      }
      const Me = ea[ut];
      let Ve = ta[ut], et = ut + 1;
      for (; et < ee && el[et] && ea[et] === Ve + 1 && G.charCodeAt(Ve) === 32; )
        Ve = ta[et], et++;
      dt.length > 0 && (dt += " "), dt += G.slice(Me, Ve), ut = et;
    }
    return dt;
  }, qn = 16384, Yn = new Int32Array(qn * 2);
  let Ya = 0, zt = 1, Tt = /* @__PURE__ */ Object.create(null), kt = /* @__PURE__ */ Object.create(null), An = /* @__PURE__ */ new Map(), Oi = /* @__PURE__ */ new Map(), Au = 0, Ou = 0;
  const ua = () => {
    Ya ^= qn, zt = zt + 1 | 0, Ou = 0;
  }, Ga = (G) => {
    let $ = Tt[G];
    if ($ !== void 0) return $;
    const ee = vc(G, 0, G.length), xe = (ee & 16383) + Ya, Le = Yn[xe] === (ee ^ zt) || Yn[xe ^ qn] === (ee ^ zt - 1);
    return Le && ($ = kt[G], $ !== void 0) ? (Tt[G] = $, $) : ($ = aa(G), Le ? (Tt[G] = $, ++Au > De && (Au = 0, kt = Tt, Tt = /* @__PURE__ */ Object.create(null), ua())) : (Yn[xe] = ee ^ zt, ++Ou > qn && ua()), $);
  }, Nu = (G) => {
    let $ = An.get(G);
    if ($ !== void 0) return $;
    const ee = vc(G, 0, G.length), xe = (ee & 16383) + Ya, Le = Yn[xe] === (ee ^ zt) || Yn[xe ^ qn] === (ee ^ zt - 1);
    return Le && ($ = Oi.get(G), $ !== void 0) ? (An.set(G, $), $) : ($ = aa(G), Le ? (An.set(G, $), ++Au > De && (Au = 0, Oi = An, An = /* @__PURE__ */ new Map(), ua())) : (Yn[xe] = ee ^ zt, ++Ou > qn && ua()), $);
  }, zu = (G) => {
    const $ = vc(G, 0, G.length), ee = ($ & 16383) + Ya;
    return Yn[ee] === ($ ^ zt) || Yn[ee ^ qn] === ($ ^ zt - 1) ? !0 : (Yn[ee] = $ ^ zt, ++Ou > qn && ua(), !1);
  }, ul = De === 0 ? aa : nS ? (G) => {
    const $ = An.get(G);
    return $ !== void 0 ? $ : Nu(G);
  } : Ga;
  return {
    merge: function() {
      return arguments.length === 1 && typeof arguments[0] == "string" ? ul(arguments[0]) : ul(uS.apply(null, arguments));
    },
    mergeString: ul,
    seenBefore: De === 0 ? () => !1 : zu,
    mergeUncached: aa
  };
}, hc = (a, r) => {
  if (!a) return "";
  if (typeof a == "string") return a;
  let o = "";
  if (typeof a.length == "number" && (!r || Array.isArray(a))) {
    const c = a;
    for (let f = 0; f < c.length; f++) {
      const d = c[f];
      if (!d) continue;
      const m = typeof d == "string" ? d : hc(d, r);
      m && (o && (o += " "), o += m);
    }
    return o;
  }
  if (r) {
    if (typeof a == "number") return "" + a;
    if (typeof a == "object")
      for (const c in a) a[c] && (o && (o += " "), o += c);
  }
  return o;
}, aS = (a, r) => {
  let o = "";
  for (let c = 0; c < a.length; c++) {
    const f = a[c];
    if (!f) continue;
    const d = typeof f == "string" ? f : hc(f, r);
    d && (o && (o += " "), o += d);
  }
  return o;
}, uS = function() {
  return aS(arguments, !1);
}, iS = 256, yh = 16, rS = 1024, od = 4096, oS = (a, r) => {
  const o = r === void 0 ? () => !0 : r.seenBefore, c = r === void 0 ? a : r.mergeUncached;
  let f = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), m = 0, p = null, h = null, y = [], b = [], g = 0;
  const x = (R, M, F) => {
    h === null && (h = new Array(od).fill(""), y = new Array(od).fill(""), b = new Array(od).fill(""));
    const A = vc(R, 0, R.length) & 4094;
    if (h[A] === R && y[A] === M) return b[A];
    if (h[A | 1] === R && y[A | 1] === M) return b[A | 1];
    const N = a(F ? M + " " + R : R), Q = h[A] === "" ? A : A | (h[A | 1] === "" ? 1 : g++ & 1);
    return h[Q] = R, y[Q] = M, b[Q] = N, N;
  }, q = (R, M, F, A) => {
    let N = 0;
    if (M) {
      if (M !== R.a0) return !1;
      N = 1;
    }
    if (F) {
      if (F !== (N === 0 ? R.a0 : R.a1)) return !1;
      N++;
    }
    if (A) {
      if (A !== (N === 0 ? R.a0 : N === 1 ? R.a1 : R.a2)) return !1;
      N++;
    }
    return N === R.t;
  }, j = (R, M) => {
    const F = R.a;
    let A = 0;
    for (let N = 0; N < M.length; N++) {
      const Q = M[N];
      if (Q) {
        if (Q !== F[A]) return !1;
        A++;
      }
    }
    return A === R.t;
  }, Y = (R, M) => {
    const F = R.length, A = p === null ? null : p.n;
    if (!M) {
      if (A !== null && j(A, R))
        return p = A, A.r;
      if (p !== null && p !== A && j(p, R)) return p.r;
    }
    let N = "", Q = -1, L = 0, V = !1;
    for (let K = 0; K < F; K++) {
      let te = R[K];
      if (te) {
        if (typeof te != "string") {
          if (te = R[K] = hc(te, !0), !te) continue;
          V = !0;
        }
        Q < 0 && (N = te, Q = K), L++;
      }
    }
    if (L === 0) return "";
    if (L === 1) return a(N);
    if (V) {
      if (A !== null && j(A, R))
        return p = A, A.r;
      if (p !== null && p !== A && j(p, R)) return p.r;
    }
    let P = f.get(N);
    P === void 0 && (P = d.get(N), P !== void 0 && f.set(N, P));
    let Z = null;
    if (P !== void 0) {
      if (P.skip > 0) {
        P.skip--, p = null;
        let te = N;
        for (let fe = Q + 1; fe < F; fe++) {
          const ae = R[fe];
          ae && (te += " " + ae);
        }
        return x(te, "", !1);
      }
      const K = P.e;
      e: for (let te = 0; te < K.length; te++) {
        const fe = K[te];
        if (fe.t !== L) continue;
        const ae = fe.a;
        let oe = 1;
        for (let I = Q + 1; I < F; I++) {
          const ce = R[I];
          if (ce && ce !== ae[oe++]) continue e;
        }
        Z = fe;
        break;
      }
      Z !== null && (P.miss = 0);
    }
    if (Z === null) {
      let K = N;
      const te = [N];
      for (let ae = Q + 1; ae < F; ae++) {
        const oe = R[ae];
        oe && (K += " " + oe, te.push(oe));
      }
      if (!o(K)) return c(K);
      Z = {
        r: a(K),
        t: te.length,
        a0: te[0],
        a1: te[1],
        a2: te[2] ?? "",
        a: te,
        n: null
      }, P === void 0 ? f.set(N, P = {
        e: [],
        miss: 0,
        skip: 0,
        at: 0
      }) : ++P.miss > yh && (P.miss = yh, P.skip = rS, P.e.length = 0, P.at = 0);
      const fe = P.e;
      fe.length < iS ? fe.push(Z) : (fe[P.at] = Z, P.at = P.at + 1 & 255), ++m > 1e3 && (m = 0, d = f, f = /* @__PURE__ */ new Map());
    }
    return p !== null && p !== Z && (p.n = Z), p = Z, Z.r;
  }, _ = (R) => Array.isArray(R) ? Y(R.slice(), !1) : a(hc(R, !0));
  return function(R, M, F) {
    const A = arguments.length;
    if ((A | 1) === 3) {
      const L = p;
      if (L !== null) {
        const V = L.n;
        if (V !== null && q(V, R, M, F))
          return p = V, V.r;
        if (L !== V && q(L, R, M, F)) return L.r;
      }
      if (A === 2 && typeof M == "string" && M !== "") {
        const V = f.get(R);
        if (V !== void 0 && V.skip > 0)
          return V.skip--, p = null, x(M, R, !0);
      }
      return Y([
        R,
        M,
        F
      ], !0);
    }
    if (A === 1) return typeof R == "string" ? a(R) : _(R);
    const N = p;
    if (N !== null) {
      const L = N.n;
      if (L !== null) {
        const V = L.a;
        let P = 0, Z = !0;
        for (let K = 0; K < A; K++) {
          const te = arguments[K];
          if (te) {
            if (te !== V[P]) {
              Z = !1;
              break;
            }
            P++;
          }
        }
        if (Z && P === L.t)
          return p = L, L.r;
      }
      if (N !== L) {
        const V = N.a;
        let P = 0, Z = !0;
        for (let K = 0; K < A; K++) {
          const te = arguments[K];
          if (te) {
            if (te !== V[P]) {
              Z = !1;
              break;
            }
            P++;
          }
        }
        if (Z && P === N.t) return N.r;
      }
    }
    const Q = [];
    for (let L = 0; L < A; L++) Q.push(arguments[L]);
    return Y(Q, !0);
  };
}, bh = /* @__PURE__ */ lS(tS), Je = /* @__PURE__ */ oS(bh.mergeString, bh);
const cS = (a) => a?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
function sS(a, r, o = []) {
  if (r == null)
    throw new Error("[lucide]: iconNode is required when icon name is used");
  return {
    name: cS(a),
    size: 24,
    node: r,
    ...o.length > 0 ? { aliases: o } : {}
  };
}
const fS = (a) => {
  let r = "", o = !1;
  for (const c of a) {
    if (c === "-" || c === "_" || c <= " ") {
      o = r.length > 0;
      continue;
    }
    r.length === 0 ? r += c.toLowerCase() : r += o ? c.toUpperCase() : c, o = !1;
  }
  return r;
};
const dS = (a) => {
  const r = fS(a);
  return r.charAt(0).toUpperCase() + r.slice(1);
};
const Ad = (...a) => a.filter((r, o, c) => !!r && r.trim() !== "" && c.indexOf(r) === o).join(" ").trim();
const hu = {
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
function cd(a) {
  return a != null;
}
function vS(a, r = {}) {
  const o = r.attributeNames ?? {}, c = (x) => o[x] ?? x, f = a.size ?? a.width ?? hu.width, d = a.size ?? a.height ?? hu.height, m = a.aliases?.filter((x) => typeof x == "string" && x.trim() !== "").map((x) => `lucide-${x}`) ?? [], p = [...a.name ? [`lucide-${a.name}`] : [], ...m], h = r.className?.split(" ").filter(Boolean) ?? [], y = r.includeDefaultClasses === !1 ? Ad(...h) : Ad("lucide", ...p, ...h), b = r.absoluteStrokeWidth ? Number(r.strokeWidth ?? hu["stroke-width"]) * Number(a.size ?? a.width ?? hu.width) / Number(r.size ?? r.width ?? hu.width) : r.strokeWidth ?? hu["stroke-width"];
  return [
    "svg",
    {
      ...Object.entries(hu).reduce((x, [q, j]) => (x[c(q)] = j, x), {}),
      ..."color" in r && r.color && {
        [c("stroke")]: r.color
      },
      ..."size" in r && cd(r.size) && {
        [c("width")]: r.size,
        [c("height")]: r.size
      },
      ..."width" in r && cd(r.width) && {
        [c("width")]: r.width
      },
      ..."height" in r && cd(r.height) && {
        [c("height")]: r.height
      },
      [c("stroke-width")]: b,
      ...y && {
        [c("class")]: y
      },
      [c("viewBox")]: `0 0 ${f} ${d}`,
      ...r.hasA11yProp === !1 ? {
        [c("aria-hidden")]: "true"
      } : {},
      ..."attributes" in r && r.attributes
    },
    a.node.map((x) => {
      const [q, j, Y] = x, _ = r.nonScalingStroke ? { [c("vector-effect")]: "non-scaling-stroke", ...j } : j;
      return Y ? [q, _, Y] : [q, _];
    })
  ];
}
function gS(a, r = {}) {
  return vS(a, {
    ...r,
    attributeNames: {
      ...r.attributeNames,
      class: "className",
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "vector-effect": "vectorEffect"
    }
  });
}
const mS = (a) => {
  for (const r in a)
    if (r.startsWith("aria-") || r === "role" || r === "title")
      return !0;
  return !1;
}, hS = S.createContext({}), pS = () => S.useContext(hS), yS = S.forwardRef(
  ({
    color: a,
    size: r,
    width: o,
    height: c,
    strokeWidth: f,
    absoluteStrokeWidth: d,
    nonScalingStroke: m,
    className: p = "",
    children: h,
    iconNode: y = [],
    icon: b = {
      node: y,
      aliases: [],
      size: 24
    },
    ...g
  }, x) => {
    const {
      size: q = 24,
      strokeWidth: j = 2,
      absoluteStrokeWidth: Y = !1,
      nonScalingStroke: _ = !1,
      color: R = "currentColor",
      className: M = ""
    } = pS() ?? {}, F = !!h || mS(g), [A, N, Q = []] = gS(b, {
      color: a ?? R,
      width: o ?? r ?? q,
      height: c ?? r ?? q,
      strokeWidth: f ?? j,
      absoluteStrokeWidth: d ?? Y,
      nonScalingStroke: m ?? _,
      className: Ad(M, p),
      hasA11yProp: F,
      attributes: g
    });
    return S.createElement(
      A,
      {
        ref: x,
        ...N
      },
      [
        ...Q.map(([L, V]) => S.createElement(L, V)),
        ...Array.isArray(h) ? h : [h]
      ]
    );
  }
);
function Fl(a, r = [], o = []) {
  const c = typeof a == "string" ? sS(a, r, o) : a, f = S.forwardRef(
    ({ className: d, ...m }, p) => S.createElement(yS, {
      ref: p,
      icon: c,
      className: d,
      ...m
    })
  );
  return c.name && (f.displayName = dS(c.name)), f;
}
const h2 = {
  name: "arrow-right",
  size: 24,
  node: [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
  ]
};
h2.node;
const bS = Fl(h2);
const p2 = {
  name: "check",
  size: 24,
  node: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]
};
p2.node;
const SS = Fl(p2);
const y2 = {
  name: "chevron-down",
  size: 24,
  node: [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]
};
y2.node;
const ES = Fl(y2);
const b2 = {
  name: "chevron-up",
  size: 24,
  node: [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]]
};
b2.node;
const TS = Fl(b2);
const S2 = {
  name: "chevron-right",
  size: 24,
  node: [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]]
};
S2.node;
const xS = Fl(S2);
const E2 = {
  name: "rotate-ccw",
  size: 24,
  node: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
  ]
};
E2.node;
const CS = Fl(E2);
const T2 = {
  name: "search",
  size: 24,
  node: [
    ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
  ]
};
T2.node;
const RS = Fl(T2);
const x2 = {
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
x2.node;
const AS = Fl(x2);
const C2 = {
  name: "x",
  size: 24,
  node: [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]
};
C2.node;
const R2 = Fl(C2);
function Cc({
  controlled: a,
  default: r,
  name: o,
  state: c = "value"
}) {
  const {
    current: f
  } = S.useRef(a !== void 0), [d, m] = S.useState(() => r), p = f && a !== void 0 ? a : d, h = S.useCallback((y) => {
    f || m(y);
  }, []);
  return [p, h];
}
const Gd = {
  ...O1
}, Sh = {};
function Ln(a, r) {
  const o = S.useRef(Sh);
  return o.current === Sh && (o.current = a(r)), o;
}
const sd = Gd.useInsertionEffect, OS = (
  // React 17 doesn't have useInsertionEffect.
  sd && // Preact replaces useInsertionEffect with useLayoutEffect and fires too late.
  sd !== Gd.useLayoutEffect ? sd : (a) => a()
);
function Ae(a) {
  const r = Ln(NS).current;
  return r.next = a, OS(r.effect), r.trampoline;
}
function NS() {
  const a = {
    next: void 0,
    callback: zS,
    trampoline: (...r) => a.callback?.(...r),
    effect: () => {
      a.callback = a.next;
    }
  };
  return a;
}
function zS() {
}
function Rt() {
}
const Ba = Object.freeze([]), Yt = Object.freeze({}), MS = () => {
}, Oe = typeof document < "u" ? S.useLayoutEffect : MS, A2 = /* @__PURE__ */ S.createContext({
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
function DS() {
  return S.useContext(A2);
}
function Xd(a) {
  const {
    children: r,
    elementsRef: o,
    labelsRef: c,
    onMapChange: f
  } = a, d = Ae(f), [, m] = S.useState(0), p = Ln(wS).current, h = Ln(_S).current, y = S.useRef(0), b = S.useRef(!0), g = S.useRef(null), x = S.useRef(null), q = Ae(() => {
    b.current || (b.current = !0, m((N) => N + 1));
  }), j = Ae((N, Q) => {
    h.set(N, Q), q();
  }), Y = Ae((N) => {
    h.delete(N), q();
  }), _ = Ae((N) => {
    const Q = /* @__PURE__ */ new Map();
    return o.current.length = 0, c && (c.current.length = 0), N.forEach((L) => {
      Q.set(L.element, {
        ...L.registration.metadata ?? {},
        index: L.index
      }), o.current[L.index] = L.element, c && (c.current[L.index] = L.registration.label !== void 0 ? L.registration.label : L.registration.textRef?.current?.textContent ?? L.element.textContent);
    }), y.current = o.current.length, Q;
  });
  function R(N) {
    if (x.current?.disconnect(), x.current = null, typeof MutationObserver != "function" || N.length < 2)
      return;
    const Q = new MutationObserver((V) => {
      if (!HS(V))
        return;
      let P = null;
      for (const Z of N)
        if (Z.isConnected) {
          if (P && O2(P, Z) > 0) {
            Q.disconnect(), q();
            return;
          }
          P = Z;
        }
    });
    x.current = Q;
    const L = /* @__PURE__ */ new Set();
    for (let V = 1; V < N.length; V += 1) {
      const P = US(N[V - 1], N[V]);
      P && L.add(P);
    }
    L.forEach((V) => Q.observe(V, {
      childList: !0
    }));
  }
  const M = Ae(() => {
    const [N, Q] = jS(h), L = _(N), V = g.current, P = !V || V.length !== N.length || N.some((Z, K) => {
      const te = V[K];
      return Z.index !== te.index || Z.element !== te.element || Z.registration.index !== te.registration.index || Z.registration.metadata !== te.registration.metadata;
    });
    R(Q), g.current = N, b.current = !1, P && (p.forEach((Z) => Z(L)), d(L));
  });
  Oe(() => (!b.current && g.current && _(g.current), () => {
    o.current = [], c && (c.current = []);
  }), [o, c, _]), Oe(() => {
    b.current && M();
  }), Oe(() => () => {
    x.current?.disconnect(), b.current = !0;
  }, []);
  const F = Ae((N) => (p.add(N), () => {
    p.delete(N);
  })), A = S.useMemo(() => ({
    register: j,
    unregister: Y,
    subscribeMapChange: F,
    nextIndexRef: y
  }), [j, Y, F, y]);
  return /* @__PURE__ */ O.jsx(A2.Provider, {
    value: A,
    children: r
  });
}
function _S() {
  return /* @__PURE__ */ new Map();
}
function wS() {
  return /* @__PURE__ */ new Set();
}
function jS(a) {
  const r = /* @__PURE__ */ new Set(), o = [], c = [];
  a.forEach((d, m) => {
    if (!m.isConnected)
      return;
    const p = d.index, h = {
      index: p ?? -1,
      element: m,
      registration: d
    };
    p === null ? c.push(h) : p >= 0 && (r.add(p), o.push(h));
  });
  let f = 0;
  return c.sort((d, m) => O2(d.element, m.element)), c.forEach((d) => {
    for (; r.has(f); )
      f += 1;
    d.index = f, o.push(d), f += 1;
  }), r.size > 0 && o.sort((d, m) => d.index - m.index), [o, c.map((d) => d.element)];
}
function US(a, r) {
  let o = a.parentElement;
  for (; o && !o.contains(r); )
    o = o.parentElement;
  return o;
}
function HS(a) {
  for (const r of a)
    for (let o = 0; o < r.removedNodes.length; o += 1)
      if (r.removedNodes[o].isConnected)
        return !0;
  return !1;
}
function O2(a, r) {
  return a.nextElementSibling === r ? -1 : r.nextElementSibling === a ? 1 : a.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
function BS(a, r) {
  return function(c, ...f) {
    const d = new URL(a);
    return d.searchParams.set("code", c.toString()), f.forEach((m) => d.searchParams.append("args[]", m)), `${r} error #${c}; visit ${d} for the full message.`;
  };
}
const Wn = BS("https://base-ui.com/production-error", "Base UI"), N2 = /* @__PURE__ */ S.createContext(void 0);
function z2() {
  const a = S.useContext(N2);
  if (a === void 0)
    throw new Error(Wn(10));
  return a;
}
function Jl(a, r, o, c) {
  const f = Ln(M2).current;
  return VS(f, a, r, o, c) && D2(f, [a, r, o, c]), f.callback;
}
function LS(a) {
  const r = Ln(M2).current;
  return qS(r, a) && D2(r, a), r.callback;
}
function M2() {
  return {
    callback: null,
    cleanup: null,
    refs: []
  };
}
function VS(a, r, o, c, f) {
  return a.refs[0] !== r || a.refs[1] !== o || a.refs[2] !== c || a.refs[3] !== f;
}
function qS(a, r) {
  return a.refs.length !== r.length || a.refs.some((o, c) => o !== r[c]);
}
function D2(a, r) {
  if (a.refs = r, r.every((o) => o == null)) {
    a.callback = null;
    return;
  }
  a.callback = (o) => {
    if (a.cleanup && (a.cleanup(), a.cleanup = null), o != null) {
      const c = Array(r.length).fill(null);
      for (let f = 0; f < r.length; f += 1) {
        const d = r[f];
        if (d != null)
          switch (typeof d) {
            case "function": {
              const m = d(o);
              typeof m == "function" && (c[f] = m);
              break;
            }
            case "object": {
              d.current = o;
              break;
            }
          }
      }
      a.cleanup = () => {
        for (let f = 0; f < r.length; f += 1) {
          const d = r[f];
          if (d != null)
            switch (typeof d) {
              case "function": {
                const m = c[f];
                typeof m == "function" ? m() : d(null);
                break;
              }
              case "object": {
                d.current = null;
                break;
              }
            }
        }
      };
    }
  };
}
const YS = parseInt(S.version, 10);
function Qd(a) {
  return YS >= a;
}
function Eh(a) {
  if (!/* @__PURE__ */ S.isValidElement(a))
    return null;
  const r = a, o = r.props;
  return (Qd(19) ? o?.ref : r.ref) ?? null;
}
function Od(a, r) {
  if (a && !r)
    return a;
  if (!a && r)
    return r;
  if (a || r)
    return {
      ...a,
      ...r
    };
}
function GS(a, r) {
  const o = {};
  for (const c in a) {
    const f = a[c];
    if (r?.hasOwnProperty(c)) {
      const d = r[c](f);
      d != null && Object.assign(o, d);
      continue;
    }
    f === !0 ? o[`data-${c.toLowerCase()}`] = "" : f && (o[`data-${c.toLowerCase()}`] = f.toString());
  }
  return o;
}
function XS(a, r) {
  return typeof a == "function" ? a(r) : a;
}
function _2(a, r) {
  return typeof a == "function" ? a(r) : a;
}
const w2 = {};
function Rc(a, r, o, c, f) {
  if (!o && !c && !a)
    return pc(r);
  let d = pc(a);
  return r && (d = gc(d, r)), o && (d = gc(d, o)), c && (d = gc(d, c)), d;
}
function QS(a) {
  if (a.length === 0)
    return w2;
  if (a.length === 1)
    return pc(a[0]);
  let r = pc(a[0]);
  for (let o = 1; o < a.length; o += 1)
    r = gc(r, a[o]);
  return r;
}
function pc(a) {
  return U2(a) ? {
    ...a(w2)
  } : KS(a);
}
function gc(a, r) {
  return U2(r) ? r(a) : IS(a, r);
}
function KS(a) {
  const r = {
    ...a
  };
  for (const o in r) {
    const c = r[o];
    j2(o, c) && (r[o] = H2(c));
  }
  return r;
}
function IS(a, r) {
  if (!r)
    return a;
  for (const o in r) {
    const c = r[o];
    switch (o) {
      case "style": {
        a[o] = Od(a.style, c);
        break;
      }
      case "className": {
        a[o] = B2(a.className, c);
        break;
      }
      default:
        j2(o, c) ? a[o] = ZS(a[o], c) : a[o] = c;
    }
  }
  return a;
}
function j2(a, r) {
  const o = a.charCodeAt(0), c = a.charCodeAt(1), f = a.charCodeAt(2);
  return o === 111 && c === 110 && f >= 65 && f <= 90 && (typeof r == "function" || typeof r > "u");
}
function U2(a) {
  return typeof a == "function";
}
function ZS(a, r) {
  return r ? a ? (...o) => {
    const c = o[0];
    if (L2(c)) {
      const d = c;
      yc(d);
      const m = r(...o);
      return d.baseUIHandlerPrevented || a?.(...o), m;
    }
    const f = r(...o);
    return a?.(...o), f;
  } : H2(r) : a;
}
function H2(a) {
  return a && ((...r) => {
    const o = r[0];
    return L2(o) && yc(o), a(...r);
  });
}
function yc(a) {
  return a.preventBaseUIHandler = () => {
    a.baseUIHandlerPrevented = !0;
  }, a;
}
function B2(a, r) {
  return r ? a ? r + " " + a : r : a;
}
function L2(a) {
  return a != null && typeof a == "object" && "nativeEvent" in a;
}
function Nt(a, r, o = {}) {
  let c = r.render;
  o.enabled !== !1 && (c = PS(c));
  const f = kS(r, o, c);
  if (o.enabled === !1)
    return null;
  const d = o.state ?? Yt;
  return WS(a, c, f, d);
}
function kS(a, r, o) {
  const {
    className: c,
    style: f
  } = a, {
    state: d = Yt,
    ref: m,
    props: p,
    stateAttributesMapping: h,
    enabled: y = !0
  } = r, b = y ? XS(c, d) : void 0, g = y ? _2(f, d) : void 0, x = y ? GS(d, h) : Yt, q = y && p ? JS(p) : void 0, j = y ? Od(x, q) ?? {} : Yt;
  return typeof document < "u" && (y ? Array.isArray(m) ? j.ref = LS([j.ref, Eh(o), ...m]) : j.ref = Jl(j.ref, Eh(o), m) : Jl(null, null)), y ? (b !== void 0 && (j.className = B2(j.className, b)), g !== void 0 && (j.style = Od(j.style, g)), j) : Yt;
}
function JS(a) {
  return Array.isArray(a) ? QS(a) : Rc(void 0, a);
}
const FS = /* @__PURE__ */ Symbol.for("react.lazy");
function PS(a) {
  if (a?.$$typeof !== FS)
    return a;
  const r = S.Children.toArray(a)[0];
  return /* @__PURE__ */ S.isValidElement(r) ? r : a;
}
function WS(a, r, o, c) {
  if (r) {
    if (typeof r == "function")
      return r(o, c);
    const f = Rc(o, r.props);
    return f.ref = o.ref, /* @__PURE__ */ S.cloneElement(r, f);
  }
  return $S(a, o);
}
function $S(a, r) {
  return a === "button" ? /* @__PURE__ */ S.createElement("button", {
    type: "button",
    ...r,
    key: r.key
  }) : a === "img" ? /* @__PURE__ */ S.createElement("img", {
    alt: "",
    ...r,
    key: r.key
  }) : /* @__PURE__ */ S.createElement(a, r);
}
const eE = {
  value: () => null
}, tE = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    disabled: d = !1,
    hiddenUntilFound: m,
    keepMounted: p,
    loopFocus: h,
    onValueChange: y,
    multiple: b = !1,
    orientation: g = "vertical",
    value: x,
    defaultValue: q,
    style: j,
    ...Y
  } = r, _ = q ?? Ba, R = S.useRef([]), [M, F] = Cc({
    controlled: x,
    default: _,
    name: "Accordion",
    state: "value"
  }), A = Ae((V, P, Z) => {
    let K;
    b ? P ? K = [...M, V] : K = M.filter((te) => te !== V) : K = M[0] === V ? [] : [V], y?.(K, Z), !Z.isCanceled && F(K);
  }), N = S.useMemo(() => ({
    value: M,
    disabled: d,
    orientation: g
  }), [M, d, g]), Q = S.useMemo(() => ({
    disabled: d,
    handleValueChange: A,
    hiddenUntilFound: m ?? !1,
    keepMounted: p ?? !1,
    state: N,
    value: M
  }), [d, A, m, p, N, M]), L = Nt("div", r, {
    state: N,
    ref: o,
    props: Y,
    stateAttributesMapping: eE
  });
  return /* @__PURE__ */ O.jsx(N2.Provider, {
    value: Q,
    children: /* @__PURE__ */ O.jsx(Xd, {
      elementsRef: R,
      children: L
    })
  });
});
function V2() {
  const [, a] = S.useState({});
  return S.useCallback(() => {
    a({});
  }, []);
}
let Th = 0;
function nE(a, r = "mui") {
  const o = S.useRef(void 0), c = V2(), f = a ?? o.current;
  return S.useEffect(() => {
    o.current == null && (Th += 1, o.current = `${r}-${Th}`, a == null && c());
  }, [a, r, c]), f;
}
const xh = Gd.useId;
function Kd(a, r) {
  if (xh !== void 0) {
    const o = xh();
    return a ?? (r ? `${r}-${o}` : o);
  }
  return nE(a, r);
}
function Pn(a) {
  return Kd(a, "base-ui");
}
function pn(a, r, o, c) {
  let f = !1, d = !1;
  const m = c ?? Yt;
  return {
    reason: a,
    event: r ?? new Event("base-ui"),
    cancel() {
      f = !0;
    },
    allowPropagation() {
      d = !0;
    },
    get isCanceled() {
      return f;
    },
    get isPropagationAllowed() {
      return d;
    },
    trigger: o,
    ...m
  };
}
const wr = "none", Id = "trigger-press", lE = "trigger-hover", q2 = "outside-press", aE = "close-press", Nd = "focus-out", uE = "escape-key", iE = "disabled", Ch = "missing", Rh = "initial", rE = "imperative-action";
function Y2(a) {
  S.useEffect(a, Ba);
}
const uc = null;
class oE {
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
  tick = (r) => {
    this.isScheduled = !1;
    const o = this.callbacks, c = this.callbacksCount;
    if (this.callbacks = [], this.callbacksCount = 0, this.startId = this.nextId, c > 0)
      for (let f = 0; f < o.length; f += 1)
        o[f]?.(r);
  };
  request(r) {
    const o = this.nextId;
    return this.nextId += 1, this.callbacks.push(r), this.callbacksCount += 1, !this.isScheduled && (requestAnimationFrame(this.tick), this.isScheduled = !0), o;
  }
  cancel(r) {
    const o = r - this.startId;
    o < 0 || o >= this.callbacks.length || this.callbacks[o] !== null && (this.callbacks[o] = null, this.callbacksCount -= 1);
  }
}
let ic = new oE();
class cn {
  static create() {
    return new cn();
  }
  static request(r) {
    return ic.request(r);
  }
  static cancel(r) {
    return ic.cancel(r);
  }
  currentId = uc;
  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  request(r) {
    this.cancel(), this.currentId = ic.request(() => {
      this.currentId = uc, r();
    });
  }
  cancel = () => {
    this.currentId !== uc && (ic.cancel(this.currentId), this.currentId = uc);
  };
  disposeEffect = () => this.cancel;
}
function Zd() {
  const a = Ln(cn.create).current;
  return Y2(a.disposeEffect), a;
}
function Ac(a, r = !1, o = !1, c = !1) {
  const [f, d] = S.useState(a && r ? "idle" : void 0), [m, p] = S.useState(a && !c);
  return a && !m && (p(!0), d("starting")), !a && m && f !== "ending" && !o && d("ending"), !a && !m && f === "ending" && d(void 0), Oe(() => {
    if (!a && m && f !== "ending" && o) {
      const h = cn.request(() => {
        d("ending");
      });
      return () => {
        cn.cancel(h);
      };
    }
  }, [a, m, f, o]), Oe(() => {
    if (!a || r || f === void 0)
      return;
    const h = cn.request(() => {
      d(void 0);
    });
    return () => {
      cn.cancel(h);
    };
  }, [r, a, f]), Oe(() => {
    if (!a || !r)
      return;
    a && m && f !== "idle" && d("starting");
    const h = cn.request(() => {
      d("idle");
    });
    return () => {
      cn.cancel(h);
    };
  }, [r, a, m, f]), {
    mounted: m,
    setMounted: p,
    transitionStatus: f
  };
}
function cE(a) {
  const {
    open: r,
    defaultOpen: o = !1,
    onOpenChange: c,
    disabled: f
  } = a, [d, m] = Cc({
    controlled: r,
    default: o,
    name: "Collapsible",
    state: "open"
  }), {
    mounted: p,
    setMounted: h,
    transitionStatus: y
  } = Ac(d, !0, !0), b = Pn(), [g, x] = S.useState(), q = g === null ? void 0 : g ?? b, j = Ae((Y) => {
    const _ = !d, R = pn(Id, Y.nativeEvent);
    c(_, R), !R.isCanceled && m(_);
  });
  return S.useMemo(() => ({
    defaultPanelId: b,
    disabled: f,
    handleTrigger: j,
    mounted: p,
    open: d,
    panelId: q,
    setMounted: h,
    setOpen: m,
    setPanelIdState: x,
    transitionStatus: y
  }), [b, f, j, p, d, q, h, m, x, y]);
}
const G2 = /* @__PURE__ */ S.createContext(void 0);
function X2() {
  const a = S.useContext(G2);
  if (a === void 0)
    throw new Error(Wn(15));
  return a;
}
function kd(a = {}) {
  const {
    guess: r,
    label: o,
    metadata: c,
    textRef: f,
    index: d
  } = a, {
    register: m,
    unregister: p,
    subscribeMapChange: h,
    nextIndexRef: y
  } = DS(), b = S.useRef(-1), [g, x] = S.useState(d == null && r ? () => {
    if (b.current === -1) {
      const _ = y.current;
      y.current += 1, b.current = _;
    }
    return b.current;
  } : -1), q = d ?? g, j = S.useRef(null), Y = S.useCallback((_) => {
    const R = j.current;
    R && p(R), j.current = _, _ && m(_, {
      metadata: c ?? null,
      index: d ?? null,
      label: o,
      textRef: f
    });
  }, [d, m, p, c, o, f]);
  return Oe(() => {
    if (d == null)
      return h((_) => {
        const R = j.current ? _.get(j.current)?.index : null;
        R != null && x(R);
      });
  }, [d, h]), {
    ref: Y,
    index: q
  };
}
const Q2 = /* @__PURE__ */ S.createContext(void 0);
function Jd() {
  const a = S.useContext(Q2);
  if (a === void 0)
    throw new Error(Wn(9));
  return a;
}
const Fd = "data-starting-style", sE = "data-ending-style", fE = {
  [Fd]: ""
}, dE = {
  [sE]: ""
}, jr = {
  transitionStatus(a) {
    return a === "starting" ? fE : a === "ending" ? dE : null;
  }
}, vE = "data-open", gE = "data-closed", rc = Fd, mE = "data-panel-open", hE = {
  [vE]: ""
}, pE = {
  [gE]: ""
}, yE = {
  open(a) {
    return a ? {
      [mE]: ""
    } : null;
  }
}, bE = {
  open(a) {
    return a ? hE : pE;
  }
}, SE = "data-index", Oc = {
  ...bE,
  index: (a) => ({
    [SE]: String(a)
  }),
  ...jr,
  value: () => null
}, EE = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    className: c,
    disabled: f = !1,
    onOpenChange: d,
    render: m,
    value: p,
    style: h,
    ...y
  } = r, {
    ref: b,
    index: g
  } = kd(), {
    disabled: x,
    handleValueChange: q,
    state: j,
    value: Y
  } = z2(), _ = Pn(), R = p ?? _, M = f || x, F = Y.includes(R), A = Ae((ae, oe) => {
    d?.(ae, oe), !oe.isCanceled && q(R, ae, oe);
  }), N = cE({
    open: F,
    onOpenChange: A,
    disabled: M
  }), Q = S.useMemo(() => ({
    ...N,
    onOpenChange: A,
    state: {
      open: N.open,
      disabled: N.disabled,
      transitionStatus: N.transitionStatus
    }
  }), [N, A]), L = S.useMemo(() => ({
    ...j,
    hidden: !F && !N.mounted,
    index: g,
    disabled: M,
    open: F
  }), [N.mounted, M, g, F, j]), V = Pn(), [P, Z] = S.useState(), K = P === null ? void 0 : P ?? V, te = S.useMemo(() => ({
    defaultTriggerId: V,
    open: F,
    state: L,
    setTriggerId: Z,
    triggerId: K
  }), [V, F, L, Z, K]), fe = Nt("div", r, {
    state: L,
    ref: [o, b],
    props: y,
    stateAttributesMapping: Oc
  });
  return /* @__PURE__ */ O.jsx(G2.Provider, {
    value: Q,
    children: /* @__PURE__ */ O.jsx(Q2.Provider, {
      value: te,
      children: fe
    })
  });
}), TE = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    ...m
  } = r, {
    state: p
  } = Jd();
  return Nt("h3", r, {
    state: p,
    ref: o,
    props: m,
    stateAttributesMapping: Oc
  });
});
function Nc() {
  return typeof window < "u";
}
function Vn(a) {
  return Pd(a) ? (a.nodeName || "").toLowerCase() : "#document";
}
function vl(a) {
  var r;
  return (a == null || (r = a.ownerDocument) == null ? void 0 : r.defaultView) || window;
}
function xE(a) {
  var r;
  return (r = (Pd(a) ? a.ownerDocument : a.document) || window.document) == null ? void 0 : r.documentElement;
}
function Pd(a) {
  return Nc() ? a instanceof Node || a instanceof vl(a).Node : !1;
}
function yi(a) {
  return Nc() ? a instanceof Element || a instanceof vl(a).Element : !1;
}
function sn(a) {
  return Nc() ? a instanceof HTMLElement || a instanceof vl(a).HTMLElement : !1;
}
function bu(a) {
  return !Nc() || typeof ShadowRoot > "u" ? !1 : a instanceof ShadowRoot || a instanceof vl(a).ShadowRoot;
}
function CE(a) {
  const {
    overflow: r,
    overflowX: o,
    overflowY: c,
    display: f
  } = zc(a);
  return /auto|scroll|overlay|hidden|clip/.test(r + c + o) && f !== "inline" && f !== "contents";
}
function fd(a) {
  return /^(html|body|#document)$/.test(Vn(a));
}
function zc(a) {
  return vl(a).getComputedStyle(a);
}
function RE(a) {
  if (Vn(a) === "html")
    return a;
  const r = (
    // Step into the shadow DOM of the parent of a slotted node.
    a.assignedSlot || // DOM Element detected.
    a.parentNode || // ShadowRoot detected.
    bu(a) && a.host || // Fallback.
    xE(a)
  );
  return bu(r) ? r.host : r;
}
const K2 = /* @__PURE__ */ S.createContext(void 0);
function Wd(a = !1) {
  const r = S.useContext(K2);
  if (r === void 0 && !a)
    throw new Error(Wn(16));
  return r;
}
function AE(a) {
  const {
    focusableWhenDisabled: r,
    disabled: o,
    composite: c = !1,
    tabIndex: f = 0,
    isNativeButton: d
  } = a, m = c && r !== !1, p = c && r === !1;
  return {
    props: S.useMemo(() => {
      const y = {
        // allow Tabbing away from focusableWhenDisabled elements
        onKeyDown(b) {
          o && r && b.key !== "Tab" && b.preventDefault();
        }
      };
      return c || (y.tabIndex = f, !d && o && (y.tabIndex = r ? f : -1)), (d && (r || m) || !d && o) && (y["aria-disabled"] = o), d && (!r || p) && (y.disabled = o), y;
    }, [c, o, r, m, p, d, f])
  };
}
function Dt(a) {
  return a?.ownerDocument || document;
}
function mc(a, r, {
  detail: o = 0,
  pointerType: c = ""
} = {}) {
  a.dispatchEvent(new (vl(a)).PointerEvent("click", {
    bubbles: !0,
    cancelable: !0,
    composed: !0,
    detail: o,
    pointerType: c,
    shiftKey: r.shiftKey,
    ctrlKey: r.ctrlKey,
    altKey: r.altKey,
    metaKey: r.metaKey
  }));
}
function Ti(a = {}) {
  const {
    disabled: r = !1,
    focusableWhenDisabled: o,
    tabIndex: c = 0,
    native: f = !0,
    composite: d
  } = a, m = S.useRef(null), p = Wd(!0), h = d ?? p !== void 0, {
    props: y
  } = AE({
    focusableWhenDisabled: o,
    disabled: r,
    composite: h,
    tabIndex: c,
    isNativeButton: f
  }), b = S.useCallback(() => {
    const q = m.current;
    dd(q) && h && r && y.disabled === void 0 && q.disabled && (q.disabled = !1);
  }, [r, y.disabled, h]);
  Oe(b, [b]);
  const g = S.useCallback((q = {}) => {
    const {
      onClick: j,
      onMouseDown: Y,
      onKeyUp: _,
      onKeyDown: R,
      onPointerDown: M,
      ...F
    } = q;
    return Rc({
      onClick(A) {
        if (r) {
          A.preventDefault();
          return;
        }
        j?.(A);
      },
      onMouseDown(A) {
        r || Y?.(A);
      },
      onKeyDown(A) {
        if (r || (yc(A), R?.(A), A.baseUIHandlerPrevented))
          return;
        const N = A.target === A.currentTarget, Q = A.currentTarget, L = dd(Q), V = !f && OE(Q), P = N && (f ? L : !V), Z = A.key === "Enter", K = A.key === " ", te = Q.getAttribute("role"), fe = te?.startsWith("menuitem") || te === "option" || te === "gridcell";
        if (N && h && K) {
          if (A.defaultPrevented && fe)
            return;
          A.preventDefault(), (!f || L) && (A.preventBaseUIHandler(), mc(Q, A));
          return;
        }
        if (!P || f || !K && !Z) {
          N && V && K && A.preventDefault();
          return;
        }
        A.defaultPrevented || (A.preventDefault(), Z && (A.preventBaseUIHandler(), mc(Q, A)));
      },
      onKeyUp(A) {
        if (!r) {
          if (yc(A), _?.(A), A.target === A.currentTarget && f && h && dd(A.currentTarget) && A.key === " ") {
            A.preventDefault();
            return;
          }
          A.baseUIHandlerPrevented || A.target === A.currentTarget && !f && !h && !A.defaultPrevented && A.key === " " && (A.preventBaseUIHandler(), mc(A.currentTarget, A));
        }
      },
      onPointerDown(A) {
        if (r) {
          A.preventDefault();
          return;
        }
        M?.(A);
      }
    }, f ? {
      type: "button"
    } : {
      role: "button"
    }, y, F);
  }, [r, y, h, f]), x = Ae((q) => {
    m.current = q, b();
  });
  return {
    getButtonProps: g,
    buttonRef: x
  };
}
function dd(a) {
  return sn(a) && a.tagName === "BUTTON";
}
function OE(a) {
  return sn(a) && a.tagName === "A" && !!a.href;
}
const NE = {
  ...Oc,
  ...yE
}, zE = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    disabled: c,
    className: f,
    id: d,
    render: m,
    nativeButton: p = !0,
    style: h,
    ...y
  } = r, {
    panelId: b,
    open: g,
    handleTrigger: x,
    disabled: q
  } = X2(), j = c || q, {
    getButtonProps: Y,
    buttonRef: _
  } = Ti({
    disabled: j,
    native: p
  }), {
    defaultTriggerId: R,
    state: M,
    setTriggerId: F
  } = Jd(), A = d || void 0, N = A ?? R;
  return Oe(() => (F((V) => A ?? (V === null ? void 0 : V)), () => {
    F((V) => V === A ? null : V);
  }), [A, F]), Nt("button", r, {
    state: M,
    ref: [o, _],
    props: [{
      "aria-controls": g ? b : void 0,
      "aria-expanded": g,
      id: N,
      onClick: x
    }, y, Y],
    stateAttributesMapping: NE
  });
});
function mt(a, r, o, c) {
  return a.addEventListener(r, o, c), () => {
    a.removeEventListener(r, o, c);
  };
}
const Er = 0;
class Su {
  static create() {
    return new Su();
  }
  currentId = Er;
  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  start(r, o) {
    this.clear(), this.currentId = setTimeout(() => {
      this.currentId = Er, o();
    }, r);
  }
  isStarted() {
    return this.currentId !== Er;
  }
  clear = () => {
    this.currentId !== Er && (clearTimeout(this.currentId), this.currentId = Er);
  };
  disposeEffect = () => this.clear;
}
function yu() {
  const a = Ln(Su.create).current;
  return Y2(a.disposeEffect), a;
}
function pi(a) {
  const r = Ln(ME, a).current;
  return r.next = a, Oe(r.effect), r;
}
function ME(a) {
  const r = {
    current: a,
    next: a,
    effect: () => {
      r.current = r.next;
    }
  };
  return r;
}
function kl(a) {
  return a == null ? a : "current" in a ? a.current : a;
}
function Ah(a, r) {
  return a.getAnimations(r).filter((o) => {
    const c = o.effect?.getTiming();
    return c?.duration !== 1 / 0 && c?.iterations !== 1 / 0;
  });
}
let oc = null;
function DE(a) {
  if (!oc) {
    const r = [];
    oc = r, queueMicrotask(() => {
      oc = null, _r.flushSync(() => {
        for (const o of r)
          o();
      });
    });
  }
  oc.push(a);
}
function I2(a, r = !1, o = !1) {
  const c = Zd();
  return Ae((f, d = null) => {
    c.cancel();
    const m = kl(a);
    if (m == null)
      return;
    const p = m, h = () => {
      if (!o) {
        _r.flushSync(f);
        return;
      }
      DE(() => {
        d?.aborted || f();
      });
    };
    if (typeof p.getAnimations != "function" || globalThis.BASE_UI_ANIMATIONS_DISABLED) {
      f();
      return;
    }
    function y() {
      Promise.all(Ah(p).map((b) => b.finished.then(Rt))).then(() => {
        d?.aborted || h();
      }, () => {
        if (d?.aborted)
          return;
        if (Ah(p).some((g) => g.pending || g.playState !== "finished")) {
          y();
          return;
        }
        h();
      });
    }
    if (r) {
      const b = Fd;
      if (!p.hasAttribute(b)) {
        c.request(y);
        return;
      }
      const g = new MutationObserver(() => {
        p.hasAttribute(b) || (g.disconnect(), y());
      });
      g.observe(p, {
        attributes: !0,
        attributeFilter: [b]
      }), d?.addEventListener("abort", () => g.disconnect(), {
        once: !0
      });
      return;
    }
    c.request(y);
  });
}
function Ur(a) {
  const {
    enabled: r = !0,
    open: o,
    ref: c,
    batch: f = !1,
    onComplete: d
  } = a, m = Ae(d), p = I2(c, o, f);
  S.useEffect(() => {
    if (!r)
      return;
    const h = new AbortController();
    return p(m, h.signal), () => {
      h.abort();
    };
  }, [r, o, m, p]);
}
const mi = {
  height: void 0,
  width: void 0
};
function _E(a) {
  const {
    externalRef: r,
    hiddenUntilFound: o,
    id: c,
    keepMounted: f,
    mounted: d,
    onOpenChange: m,
    open: p,
    setMounted: h,
    setOpen: y,
    transitionStatus: b
  } = a, g = S.useRef(null), x = S.useRef(null), [q, j] = S.useState(mi), Y = S.useRef(mi), _ = S.useRef(!1), R = S.useRef(p), M = S.useRef(!1), [F, A] = S.useState(!1), N = S.useRef(null), Q = Jl(r, g), L = pi(p), V = I2(g), P = !p && !d, Z = F ? "idle" : b, K = p && // These 2 refs are safe to read in render, they are only written from committed
  // layout/effect paths and gate one-shot motion suppression for the next open
  // lifecycle. They intentionally expose the last committed motion snapshot.
  (R.current || M.current), te = !p && d && // These 2 refs are also safe to read in render, both hold the last committed
  // animation mode and measurement. This fallback only restores a previously
  // measured pixel size after the live dimensions state has been reset back to `auto`.
  x.current === "css-animation" && q.height === void 0 && q.width === void 0 ? Y.current : q, fe = o && P && x.current !== "css-animation", ae = Ae((ie, W = !0) => {
    W && (Y.current = ie), j(ie);
  }), oe = Ae(() => {
    N.current?.(), N.current = null;
  }), I = Ae((ie) => {
    oe(), N.current = () => {
      N.current = null, ie();
    };
  }), ce = Ae(() => {
    p && d && x.current === "css-animation" && (M.current = !0);
  });
  Oe(() => {
    !F || b === "starting" || A(!1);
  }, [F, b]), S.useEffect(() => () => {
    ce(), oe();
  }, [ce, oe]), Oe(() => {
    p || (R.current = !1, M.current = !1);
    const ie = g.current;
    if (!ie)
      return;
    !p && N.current && oe();
    const W = wE(ie, K);
    if (x.current = W, p && b === "idle" && R.current && W === "css-animation") {
      Y.current = hi(ie);
      return;
    }
    if (p && b === "starting") {
      const De = _.current;
      if (_.current = !1, W === "none") {
        ae(hi(ie)), A(!0);
        return;
      }
      if (W === "css-transition") {
        const le = jE(ie);
        if (ae(hi(ie)), !De)
          return le;
        const re = cc(ie, "transition-duration", "0s");
        return I(re), A(!0), le;
      }
      ae(hi(ie));
      const E = cc(ie, "animation-name", "none");
      if (!De) {
        E();
        return;
      }
      const U = cc(ie, "animation-duration", "0s");
      E(), I(U), A(!0);
      return;
    }
    if (!p && d && (b === "idle" || b === "starting")) {
      if (W === "none") {
        ae(mi, !1), h(!1);
        return;
      }
      ae(hi(ie));
      return;
    }
    if (b !== "ending")
      return;
    if (W === "none") {
      h(!1);
      return;
    }
    const ze = hi(ie);
    if (!(ze.height > 0 || ze.width > 0)) {
      h(!1);
      return;
    }
    ae(ze), W === "css-animation" && cc(ie, "animation-name", "none")();
  }, [d, p, oe, ae, h, I, K, b]), Ur({
    enabled: p && d && Z === "idle",
    open: !0,
    ref: g,
    onComplete() {
      p && ae(mi, !1);
    }
  }), S.useEffect(() => {
    if (p || !d || Z !== "ending")
      return;
    if (!g.current) {
      h(!1), ae(mi, !1);
      return;
    }
    const W = new AbortController();
    let ze = -1;
    function pe() {
      L.current || (h(!1), ae(mi, !1));
    }
    return ze = cn.request(() => {
      V(pe, W.signal);
    }), () => {
      cn.cancel(ze), W.abort();
    };
  }, [L, d, p, Z, V, ae, h]), Oe(() => {
    const ie = g.current;
    !ie || !o || !P || ie.setAttribute("hidden", "until-found");
  }, [P, o]), S.useEffect(function() {
    const W = g.current;
    if (!W)
      return;
    const ze = Su.create();
    let pe = -1;
    const De = (le, re) => {
      ze.start(0, () => {
        L.current || (pe = cn.request(() => {
          L.current || (le && (_.current = !1), re && W.setAttribute(rc, ""), W.setAttribute("hidden", "until-found"));
        }));
      });
    }, U = mt(W, "beforematch", (le) => {
      const re = pn(wr, le);
      if (m(!0, re), re.isCanceled) {
        De(!1, !1);
        return;
      }
      _.current = !0;
      const me = W.hasAttribute(rc);
      W.removeAttribute(rc), y(!0), De(!0, me);
    });
    return () => {
      ze.clear(), cn.cancel(pe), U();
    };
  }, [L, m, y]);
  const ne = f || o || d || p;
  return {
    height: te.height,
    props: {
      ...fe ? {
        [rc]: ""
      } : void 0,
      hidden: P,
      id: c
    },
    ref: Q,
    shouldPreventOpenAnimation: K,
    shouldRender: ne,
    transitionStatus: Z,
    width: te.width
  };
}
function hi(a) {
  return {
    height: a.scrollHeight,
    width: a.scrollWidth
  };
}
function wE(a, r) {
  const o = vl(a).getComputedStyle(a), c = (o.animationName.split(",").map((d) => d.trim()).some((d) => d !== "" && d !== "none") || r) && Oh(o.animationDuration), f = Oh(o.transitionDuration);
  return c && f || f ? "css-transition" : c ? "css-animation" : "none";
}
function Oh(a) {
  return a.split(",").map((r) => r.trim()).some((r) => r !== "" && Number.parseFloat(r) > 0);
}
function cc(a, r, o) {
  const c = a.style.getPropertyValue(r), f = a.style.getPropertyPriority(r);
  return a.style.setProperty(r, o), () => {
    if (c === "") {
      a.style.removeProperty(r);
      return;
    }
    a.style.setProperty(r, c, f);
  };
}
function jE(a) {
  const r = {
    "justify-content": a.style.justifyContent,
    "align-items": a.style.alignItems,
    "align-content": a.style.alignContent,
    "justify-items": a.style.justifyItems
  };
  Object.keys(r).forEach((f) => {
    a.style.setProperty(f, "initial", "important");
  });
  function o() {
    Object.entries(r).forEach(([f, d]) => {
      if (d === "") {
        a.style.removeProperty(f);
        return;
      }
      a.style.setProperty(f, d);
    });
  }
  const c = cn.request(o);
  return () => {
    cn.cancel(c), o();
  };
}
const UE = "--accordion-panel-height", HE = "--accordion-panel-width", BE = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    className: c,
    hiddenUntilFound: f,
    keepMounted: d,
    id: m,
    render: p,
    style: h,
    ...y
  } = r, {
    hiddenUntilFound: b,
    keepMounted: g
  } = z2(), {
    defaultPanelId: x,
    mounted: q,
    onOpenChange: j,
    open: Y,
    setMounted: _,
    setOpen: R,
    setPanelIdState: M,
    transitionStatus: F
  } = X2(), A = f ?? b, N = d ?? g, Q = m || void 0, L = m ?? x;
  Oe(() => (M((W) => Q ?? (W === null ? void 0 : W)), () => {
    M((W) => W === Q ? null : W);
  }), [Q, M]);
  const {
    height: V,
    props: P,
    ref: Z,
    shouldPreventOpenAnimation: K,
    shouldRender: te,
    transitionStatus: fe,
    width: ae
  } = _E({
    externalRef: o,
    hiddenUntilFound: A,
    id: L,
    keepMounted: N,
    mounted: q,
    onOpenChange: j,
    open: Y,
    setMounted: _,
    setOpen: R,
    transitionStatus: F
  }), {
    state: oe,
    triggerId: I
  } = Jd(), ce = {
    ...oe,
    transitionStatus: fe
  }, ne = _2(h, ce), ie = Nt("div", {
    ...r,
    style: void 0
  }, {
    state: ce,
    ref: Z,
    props: [
      P,
      {
        "aria-labelledby": I,
        role: "region",
        style: {
          [UE]: V === void 0 ? "auto" : `${V}px`,
          [HE]: ae === void 0 ? "auto" : `${ae}px`
        }
      },
      y,
      ne ? {
        style: ne
      } : void 0,
      // Resolve the public `style` prop so temporary `animationName: 'none'`
      // can still win after user's inline styles have been merged.
      K ? {
        style: {
          animationName: "none"
        }
      } : void 0
    ],
    stateAttributesMapping: Oc
  });
  return te ? ie : null;
});
function LE({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    tE,
    {
      "data-slot": "accordion",
      className: Je("va:flex va:w-full va:flex-col", a),
      ...r
    }
  );
}
function VE({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    EE,
    {
      "data-slot": "accordion-item",
      className: Je("va:not-last:border-b", a),
      ...r
    }
  );
}
function qE({
  className: a,
  children: r,
  ...o
}) {
  return /* @__PURE__ */ O.jsx(TE, { className: "va:flex", children: /* @__PURE__ */ O.jsxs(
    zE,
    {
      "data-slot": "accordion-trigger",
      className: Je(
        "va:group/accordion-trigger va:relative va:flex va:flex-1 va:items-start va:justify-between va:rounded-lg va:border va:border-transparent va:py-2.5 va:text-left va:text-sm va:font-medium va:transition-all va:outline-none va:hover:underline va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:focus-visible:after:border-ring va:aria-disabled:pointer-events-none va:aria-disabled:opacity-50 va:**:data-[slot=accordion-trigger-icon]:ml-auto va:**:data-[slot=accordion-trigger-icon]:size-4 va:**:data-[slot=accordion-trigger-icon]:text-muted-foreground",
        a
      ),
      ...o,
      children: [
        r,
        /* @__PURE__ */ O.jsx(ES, { "data-slot": "accordion-trigger-icon", className: "va:pointer-events-none va:shrink-0 va:group-aria-expanded/accordion-trigger:hidden" }),
        /* @__PURE__ */ O.jsx(TS, { "data-slot": "accordion-trigger-icon", className: "va:pointer-events-none va:hidden va:shrink-0 va:group-aria-expanded/accordion-trigger:inline" })
      ]
    }
  ) });
}
function YE({
  className: a,
  children: r,
  ...o
}) {
  return /* @__PURE__ */ O.jsx(
    BE,
    {
      "data-slot": "accordion-content",
      className: "va:overflow-hidden va:text-sm va:data-open:animate-accordion-down va:data-closed:animate-accordion-up",
      ...o,
      children: /* @__PURE__ */ O.jsx(
        "div",
        {
          className: Je(
            "va:h-(--accordion-panel-height) va:pt-0 va:pb-2.5 va:data-ending-style:h-0 va:data-starting-style:h-0 va:[&_a]:underline va:[&_a]:underline-offset-3 va:[&_a]:hover:text-foreground va:[&_p:not(:last-child)]:mb-4",
            a
          ),
          children: r
        }
      )
    }
  );
}
function GE(a) {
  return Nt(a.defaultTagName ?? "div", a, a);
}
function Z2(a) {
  var r, o, c = "";
  if (typeof a == "string" || typeof a == "number") c += a;
  else if (typeof a == "object") if (Array.isArray(a)) {
    var f = a.length;
    for (r = 0; r < f; r++) a[r] && (o = Z2(a[r])) && (c && (c += " "), c += o);
  } else for (o in a) a[o] && (c && (c += " "), c += o);
  return c;
}
function XE() {
  for (var a, r, o = 0, c = "", f = arguments.length; o < f; o++) (a = arguments[o]) && (r = Z2(a)) && (c && (c += " "), c += r);
  return c;
}
const Nh = (a) => typeof a == "boolean" ? `${a}` : a === 0 ? "0" : a, zh = XE, Mc = (a, r) => (o) => {
  var c;
  if (r?.variants == null) return zh(a, o?.class, o?.className);
  const { variants: f, defaultVariants: d } = r, m = Object.keys(f).map((y) => {
    const b = o?.[y], g = d?.[y];
    if (b === null) return null;
    const x = Nh(b) || Nh(g);
    return f[y][x];
  }), p = o && Object.entries(o).reduce((y, b) => {
    let [g, x] = b;
    return x === void 0 || (y[g] = x), y;
  }, {}), h = r == null || (c = r.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((y, b) => {
    let { class: g, className: x, ...q } = b;
    return Object.entries(q).every((j) => {
      let [Y, _] = j;
      return Array.isArray(_) ? _.includes({
        ...d,
        ...p
      }[Y]) : {
        ...d,
        ...p
      }[Y] === _;
    }) ? [
      ...y,
      g,
      x
    ] : y;
  }, []);
  return zh(a, m, h, o?.class, o?.className);
}, QE = Mc(
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
function bi({
  className: a,
  variant: r = "default",
  render: o,
  ...c
}) {
  return GE({
    defaultTagName: "span",
    props: Rc(
      {
        className: Je(QE({ variant: r }), a)
      },
      c
    ),
    render: o,
    state: {
      slot: "badge",
      variant: r
    }
  });
}
const KE = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    disabled: d = !1,
    focusableWhenDisabled: m = !1,
    nativeButton: p = !0,
    style: h,
    ...y
  } = r, {
    getButtonProps: b,
    buttonRef: g
  } = Ti({
    disabled: d,
    focusableWhenDisabled: m,
    native: p
  });
  return Nt("button", r, {
    state: {
      disabled: d
    },
    ref: [o, g],
    props: [y, b]
  });
}), IE = Mc(
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
function ja({
  className: a,
  variant: r = "default",
  type: o = "button",
  size: c = "default",
  ...f
}) {
  return /* @__PURE__ */ O.jsx(
    KE,
    {
      "data-slot": "button",
      type: o,
      className: Je(IE({ variant: r, size: c, className: a })),
      ...f
    }
  );
}
function $d({
  className: a,
  size: r = "default",
  variant: o = "default",
  ...c
}) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "card",
      "data-size": r,
      "data-variant": o,
      className: Je(
        "va:group/card va:flex va:flex-col va:gap-(--card-spacing) va:overflow-hidden va:rounded-xl va:bg-card va:py-(--card-spacing) va:text-sm va:text-card-foreground va:ring-1 va:ring-foreground/10 va:[--card-spacing:--spacing(4)] va:has-data-[slot=card-footer]:pb-0 va:has-[>img:first-child]:pt-0 va:data-[size=sm]:[--card-spacing:--spacing(3)] va:data-[size=sm]:has-data-[slot=card-footer]:pb-0 va:*:[img:first-child]:rounded-t-xl va:*:[img:last-child]:rounded-b-xl",
        o !== "default" && "armory-card",
        a
      ),
      ...c
    }
  );
}
function e0({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "card-header",
      className: Je(
        "va:group/card-header va:@container/card-header va:grid va:auto-rows-min va:items-start va:gap-1 va:rounded-t-xl va:px-(--card-spacing) va:has-data-[slot=card-action]:grid-cols-[1fr_auto] va:has-data-[slot=card-description]:grid-rows-[auto_auto] va:[.border-b]:pb-(--card-spacing)",
        a
      ),
      ...r
    }
  );
}
function t0({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "card-title",
      className: Je(
        "va:text-base va:leading-snug va:font-medium va:group-data-[size=sm]/card:text-sm",
        a
      ),
      ...r
    }
  );
}
function bc({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "card-description",
      className: Je("va:text-sm va:text-muted-foreground", a),
      ...r
    }
  );
}
function n0({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "card-content",
      className: Je("va:px-(--card-spacing)", a),
      ...r
    }
  );
}
function l0({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "card-footer",
      className: Je(
        "va:flex va:items-center va:rounded-b-xl va:border-t va:bg-muted/50 va:p-(--card-spacing)",
        a
      ),
      ...r
    }
  );
}
const k2 = /* @__PURE__ */ S.createContext(void 0);
function La(a) {
  const r = S.useContext(k2);
  if (!a && r === void 0)
    throw new Error(Wn(27));
  return r;
}
const ZE = "data-open", kE = "data-closed", JE = "data-anchor-hidden", FE = "data-popup-open", PE = {
  [FE]: ""
}, WE = {
  [ZE]: ""
}, $E = {
  [kE]: ""
}, eT = {
  [JE]: ""
}, tT = {
  open(a) {
    return a ? PE : null;
  }
}, J2 = {
  open(a) {
    return a ? WE : $E;
  },
  anchorHidden(a) {
    return a ? eT : null;
  }
}, nT = {
  ...J2,
  ...jr
}, lT = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    forceRender: m = !1,
    ...p
  } = r, h = La(), y = h.useState("open"), b = h.useState("nested"), g = h.useState("mounted"), x = h.useState("transitionStatus");
  return Nt("div", r, {
    state: {
      open: y,
      transitionStatus: x
    },
    ref: [h.context.backdropRef, o],
    stateAttributesMapping: nT,
    props: [{
      role: "presentation",
      hidden: !g,
      style: {
        userSelect: "none",
        WebkitUserSelect: "none"
      }
    }, p],
    enabled: m || !b
  });
}), F2 = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    disabled: m = !1,
    nativeButton: p = !0,
    ...h
  } = r, y = La(), b = y.useState("open"), {
    getButtonProps: g,
    buttonRef: x
  } = Ti({
    disabled: m,
    native: p
  }), q = {
    disabled: m
  };
  function j(Y) {
    b && y.setOpen(!1, pn(aE, Y.nativeEvent));
  }
  return Nt("button", r, {
    state: q,
    ref: [o, x],
    props: [{
      onClick: j
    }, h, g]
  });
}), aT = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    id: m,
    ...p
  } = r, h = La(), y = Pn(m);
  return h.useSyncedValueWithCleanup("descriptionElementId", y), Nt("p", r, {
    ref: o,
    props: [{
      id: y
    }, p]
  });
});
function uT() {
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
  userAgent: iT,
  platform: rT,
  maxTouchPoints: oT
} = uT(), Dc = iT.toLowerCase(), zr = rT.toLowerCase(), _c = /^i(os$|p)/.test(zr) || zr === "macintel" && oT > 1, Mh = "android", zd = zr === Mh || Dc.includes(Mh), cT = !_c && zr.startsWith("mac");
zr.startsWith("win");
const sT = cT || _c, xi = typeof CSS < "u" && !!CSS.supports?.("-webkit-backdrop-filter:none");
!xi && Dc.includes("firefox");
!xi && Dc.includes("chrom");
const fT = sT, dT = /jsdom|happydom/.test(Dc);
function vT(a) {
  a.preventDefault(), a.stopPropagation();
}
function gT(a) {
  return "nativeEvent" in a;
}
function Sc(a) {
  return a.pointerType === "" && a.isTrusted ? !0 : zd && a.pointerType ? a.type === "click" && a.buttons === 1 : a.detail === 0 && !a.pointerType;
}
function P2(a) {
  return dT ? !1 : !zd && a.width === 0 && a.height === 0 || // Chrome synthesizes a screen reader press (TalkBack, VoiceOver, NVDA) as a 1x1 mouse
  // `pointerdown` with no pressure. TalkBack can report a pressed button, while desktop
  // mouse presses can report no pressure, so only require no pressed button off Android.
  a.type === "pointerdown" && a.width === 1 && a.height === 1 && a.pressure === 0 && a.detail === 0 && a.pointerType === "mouse" && (zd || a.buttons === 0) || // iOS VoiceOver returns 0.333• for width/height.
  a.width < 1 && a.height < 1 && a.pressure === 0 && a.detail === 0 && a.pointerType === "touch";
}
function vd(a, r) {
  return ["mouse", "pen"].includes(a);
}
function mT(a) {
  const r = a.type;
  return r === "click" || r === "mousedown" || r === "keydown" || r === "keyup";
}
function Ol(a) {
  let r = a.activeElement;
  for (; r?.shadowRoot?.activeElement != null; )
    r = r.shadowRoot.activeElement;
  return r;
}
function rt(a, r) {
  if (!a || !r)
    return !1;
  const o = r.getRootNode?.();
  if (a.contains(r))
    return !0;
  if (o && bu(o)) {
    let c = r;
    for (; c; ) {
      if (a === c)
        return !0;
      c = c.parentNode || c.host;
    }
  }
  return !1;
}
function hT(a, r) {
  let o = a;
  for (; o; ) {
    if (yi(o) && o.matches(r))
      return o;
    o = o.assignedSlot ?? o.parentNode ?? (bu(o) ? o.host : null);
  }
  return null;
}
function dl(a) {
  return "composedPath" in a ? a.composedPath()[0] ?? a.target : a.target;
}
const Md = "data-base-ui-focusable", pT = "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])";
function gd(a, r) {
  if (r == null)
    return !1;
  if ("composedPath" in a)
    return a.composedPath().includes(r);
  const o = a;
  return o.target != null && r.contains(o.target);
}
function yT(a) {
  return a.matches("html,body");
}
function a0(a) {
  return sn(a) && a.matches(pT);
}
function Dh(a) {
  return a ? a.getAttribute("role") === "combobox" && a0(a) : !1;
}
function _h(a) {
  return a ? a.hasAttribute(Md) ? a : a.querySelector(`[${Md}]`) || a : null;
}
function Si(...a) {
  return () => {
    for (let r = 0; r < a.length; r += 1) {
      const o = a[r];
      o && o();
    }
  };
}
const W2 = {
  clipPath: "inset(50%)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  margin: -1
}, $2 = {
  ...W2,
  position: "fixed",
  margin: 0,
  top: 0,
  left: 0
}, bT = {
  ...W2,
  position: "absolute"
}, Ec = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const [c, f] = S.useState();
  Oe(() => {
    fT && xi && f("button");
  }, []);
  const d = {
    tabIndex: 0,
    // Role is only for VoiceOver
    role: c
  };
  return /* @__PURE__ */ O.jsx("span", {
    ...r,
    ref: o,
    style: $2,
    "aria-hidden": c ? void 0 : !0,
    ...d,
    "data-base-ui-focus-guard": ""
  });
});
function md(a, r) {
  return r < 0 || r >= a.length;
}
function ST(a, r) {
  return Cr(a.current, {
    disabledIndices: r
  });
}
function ET(a, r) {
  return Cr(a.current, {
    decrement: !0,
    startingIndex: a.current.length,
    disabledIndices: r
  });
}
function Cr(a, {
  startingIndex: r = -1,
  decrement: o = !1,
  disabledIndices: c,
  amount: f = 1
} = {}) {
  let d = r;
  do
    d += o ? -f : f;
  while (d >= 0 && d <= a.length - 1 && Rr(a, d, c));
  return d;
}
function Rr(a, r, o) {
  if (typeof o == "function" ? o(r) : o?.includes(r) ?? !1)
    return !0;
  const f = a[r];
  return f ? !u0(f) || f.matches(":disabled") ? !0 : !o && (f.hasAttribute("disabled") || f.getAttribute("aria-disabled") === "true") : !1;
}
function TT(a) {
  return a.visibility === "hidden" || a.visibility === "collapse";
}
function u0(a, r = a ? zc(a) : null) {
  return !a || !a.isConnected || !r || TT(r) ? !1 : typeof a.checkVisibility == "function" ? a.checkVisibility() : r.display !== "none" && r.display !== "contents";
}
const xT = 'a[href],button,input,select,textarea,summary,details,iframe,object,embed,[tabindex],[contenteditable]:not([contenteditable="false"]),audio[controls],video[controls]';
function CT(a) {
  const r = a.assignedSlot;
  if (r)
    return r;
  if (a.parentElement)
    return a.parentElement;
  const o = a.getRootNode();
  return bu(o) ? o.host : null;
}
function Dd(a) {
  for (const r of Array.from(a.children))
    if (Vn(r) === "summary")
      return r;
  return null;
}
function RT(a, r) {
  const o = Dd(r);
  return !!o && (a === o || rt(o, a));
}
function ep(a) {
  const r = a ? Vn(a) : "";
  return a != null && a.matches(xT) && (r !== "summary" || a.parentElement != null && Vn(a.parentElement) === "details" && Dd(a.parentElement) === a) && (r !== "details" || Dd(a) == null) && (r !== "input" || a.type !== "hidden");
}
function tp(a) {
  if (!ep(a) || !a.isConnected || a.matches(":disabled"))
    return !1;
  for (let r = a; r; r = CT(r)) {
    const o = r !== a, c = Vn(r) === "slot";
    if (r.hasAttribute("inert") || o && Vn(r) === "details" && !r.open && !RT(a, r) || r.hasAttribute("hidden") || !c && !AT(r, o))
      return !1;
  }
  return !0;
}
function AT(a, r) {
  const o = zc(a);
  return r ? o.display !== "none" : u0(a, o);
}
function np(a) {
  const r = a.tabIndex;
  if (r < 0) {
    const o = Vn(a);
    if (o === "details" || o === "audio" || o === "video" || sn(a) && a.isContentEditable)
      return 0;
  }
  return r;
}
function hd(a) {
  if (Vn(a) !== "input")
    return null;
  const r = a;
  return r.type === "radio" && r.name !== "" ? r : null;
}
function OT(a, r) {
  const o = hd(a);
  if (!o)
    return !0;
  const c = r.find((f) => {
    const d = hd(f);
    return d?.name === o.name && d.form === o.form && d.checked;
  });
  return c ? c === o : r.find((f) => {
    const d = hd(f);
    return d?.name === o.name && d.form === o.form;
  }) === o;
}
function lp(a) {
  if (sn(a) && Vn(a) === "slot") {
    const r = a.assignedElements({
      flatten: !0
    });
    if (r.length > 0)
      return r;
  }
  return sn(a) && a.shadowRoot ? Array.from(a.shadowRoot.children) : Array.from(a.children);
}
function ap(a, r) {
  lp(a).forEach((o) => {
    ep(o) && r.push(o), ap(o, r);
  });
}
function up(a, r, o) {
  lp(a).forEach((c) => {
    sn(c) && c.matches(r) && o.push(c), up(c, r, o);
  });
}
function i0(a) {
  return tp(a) && np(a) >= 0;
}
function ip(a) {
  const r = [];
  return ap(a, r), r.filter(tp);
}
function wc(a) {
  const r = ip(a);
  return r.filter((o) => np(o) >= 0 && OT(o, r));
}
function rp(a, r) {
  const o = wc(a), c = o.length;
  if (c === 0)
    return;
  const f = Ol(Dt(a)), d = o.indexOf(f), m = d === -1 ? r === 1 ? 0 : c - 1 : d + r;
  return o[m];
}
function op(a) {
  return rp(Dt(a).body, 1) || a;
}
function cp(a) {
  return rp(Dt(a).body, -1) || a;
}
function Ar(a, r) {
  const o = r || a.currentTarget, c = a.relatedTarget;
  return !c || !rt(o, c);
}
function NT(a) {
  wc(a).forEach((o) => {
    o.dataset.tabindex = o.getAttribute("tabindex") || "", o.setAttribute("tabindex", "-1");
  });
}
function wh(a) {
  const r = [];
  up(a, "[data-tabindex]", r), r.forEach((o) => {
    const c = o.dataset.tabindex;
    delete o.dataset.tabindex, c ? o.setAttribute("tabindex", c) : o.removeAttribute("tabindex");
  });
}
function Mr(a, r, o = !0) {
  return a.filter((f) => f.parentId === r).flatMap((f) => [...!o || f.context?.open ? [f] : [], ...Mr(a, f.id, o)]);
}
function jh(a, r) {
  let o = [], c = a.find((f) => f.id === r)?.parentId;
  for (; c; ) {
    const f = a.find((d) => d.id === c);
    c = f?.parentId, f && (o = o.concat(f));
  }
  return o;
}
function Or(a) {
  return `data-base-ui-${a}`;
}
let sc = 0;
function pd(a, r = {}) {
  const {
    preventScroll: o = !1,
    sync: c = !1,
    shouldFocus: f
  } = r;
  cancelAnimationFrame(sc);
  function d() {
    f && !f() || a?.focus({
      preventScroll: o
    });
  }
  if (c)
    return d(), Rt;
  const m = requestAnimationFrame(d);
  return sc = m, () => {
    sc === m && (cancelAnimationFrame(m), sc = 0);
  };
}
const Uh = "data-base-ui-inert";
let Tr = /* @__PURE__ */ new WeakMap(), fc = /* @__PURE__ */ new WeakSet(), xr = /* @__PURE__ */ new WeakMap(), yd = 0;
function sp(a) {
  return a ? bu(a) ? a.host : sp(a.parentNode) : null;
}
const Hh = (a, r) => r.map((o) => {
  if (a.contains(o))
    return o;
  const c = sp(o);
  return a.contains(c) ? c : null;
}).filter((o) => o != null), Bh = (a) => {
  const r = /* @__PURE__ */ new Set();
  return a.forEach((o) => {
    let c = o;
    for (; c && !r.has(c); )
      r.add(c), c = c.parentNode;
  }), r;
}, Lh = (a, r, o) => {
  const c = [], f = (d) => {
    !d || o.has(d) || Array.from(d.children).forEach((m) => {
      Vn(m) !== "script" && (r.has(m) ? f(m) : c.push(m));
    });
  };
  return f(a), c;
};
function zT(a, r, o, {
  mark: c = !0
}) {
  const f = Hh(r, a), d = c ? Lh(r, Bh(f), new Set(f)) : [], m = [], p = [];
  if (o) {
    const h = Hh(r, Array.from(r.querySelectorAll("[aria-live]"))), y = f.concat(h);
    Lh(r, Bh(y), new Set(y)).forEach((g) => {
      const x = g.getAttribute("aria-hidden"), q = x !== null && x !== "false", j = (Tr.get(g) || 0) + 1;
      Tr.set(g, j), m.push(g), j === 1 && q && fc.add(g), q || g.setAttribute("aria-hidden", "true");
    });
  }
  return c && d.forEach((h) => {
    const y = (xr.get(h) || 0) + 1;
    xr.set(h, y), p.push(h), y === 1 && h.setAttribute(Uh, "");
  }), yd += 1, () => {
    m.forEach((h) => {
      const y = (Tr.get(h) || 0) - 1;
      Tr.set(h, y), y || (fc.has(h) || h.removeAttribute("aria-hidden"), fc.delete(h));
    }), c && p.forEach((h) => {
      const y = (xr.get(h) || 0) - 1;
      xr.set(h, y), y || h.removeAttribute(Uh);
    }), yd -= 1, yd || (Tr = /* @__PURE__ */ new WeakMap(), fc = /* @__PURE__ */ new WeakSet(), xr = /* @__PURE__ */ new WeakMap());
  };
}
function Vh(a, r = {}) {
  const {
    ariaHidden: o = !1,
    mark: c = !0
  } = r, f = Dt(a[0]).body;
  return zT(a, f, o, {
    mark: c
  });
}
const fp = "data-base-ui-click-trigger", MT = {
  clipPath: "inset(50%)",
  position: "fixed",
  top: 0,
  left: 0
}, dp = /* @__PURE__ */ S.createContext(null), vp = () => S.useContext(dp), DT = Or("portal");
function _T(a = {}) {
  const {
    ref: r,
    container: o,
    componentProps: c = Yt,
    elementProps: f
  } = a, d = Kd(), p = vp()?.portalNode, [h, y] = S.useState(null), [b, g] = S.useState(null), x = Ae((_) => {
    _ !== null && g(_);
  }), q = S.useRef(null);
  Oe(() => {
    if (o === null) {
      q.current && (q.current = null, g(null), y(null));
      return;
    }
    const _ = (o && (Pd(o) ? o : o.current)) ?? p ?? document.body;
    if (_ == null) {
      q.current && (q.current = null, g(null), y(null));
      return;
    }
    q.current !== _ && (q.current = _, g(null), y(_));
  }, [o, p]);
  const j = Nt("div", c, {
    ref: [r, x],
    props: [{
      id: d,
      [DT]: ""
    }, f]
  }), Y = h && j ? /* @__PURE__ */ _r.createPortal(j, h) : null;
  return {
    node: b,
    // `id` and `render` props can override or remove the generated ID. Use the exact
    // rendered value so `aria-owns` never points at an ID absent from the DOM.
    nodeId: /* @__PURE__ */ S.isValidElement(j) ? j.props.id : void 0,
    subtree: Y
  };
}
const wT = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    children: m,
    container: p,
    portalOwnerRole: h,
    ...y
  } = r, {
    node: b,
    nodeId: g,
    subtree: x
  } = _T({
    container: p,
    ref: o,
    componentProps: r,
    elementProps: y
  }), q = S.useRef(null), j = S.useRef(null), Y = S.useRef(null), _ = S.useRef(null), [R, M] = S.useState(null), F = S.useRef(!1), A = R?.modal, N = R?.open, Q = !!R && !R.modal && R.open && !!b;
  S.useEffect(() => {
    if (!b || A)
      return;
    function V(P) {
      b && P.relatedTarget && Ar(P) && (P.type === "focusin" ? F.current && (wh(b), F.current = !1) : (NT(b), F.current = !0));
    }
    return Si(mt(b, "focusin", V, !0), mt(b, "focusout", V, !0));
  }, [b, A]), Oe(() => {
    !b || N !== !0 || !F.current || (wh(b), F.current = !1);
  }, [N, b]);
  const L = S.useMemo(() => ({
    beforeOutsideRef: q,
    afterOutsideRef: j,
    beforeInsideRef: Y,
    afterInsideRef: _,
    portalNode: b,
    setFocusManagerState: M
  }), [b]);
  return /* @__PURE__ */ O.jsxs(S.Fragment, {
    children: [x, /* @__PURE__ */ O.jsxs(dp.Provider, {
      value: L,
      children: [Q && b && /* @__PURE__ */ O.jsx(Ec, {
        "data-type": "outside",
        ref: q,
        onFocus: (V) => {
          if (Ar(V, b))
            Y.current?.focus();
          else {
            const P = R ? R.domReference : null;
            cp(P)?.focus();
          }
        }
      }), Q && b && /* @__PURE__ */ O.jsx("span", {
        role: h,
        "aria-owns": g,
        style: MT
      }), b && /* @__PURE__ */ _r.createPortal(m, b), Q && b && /* @__PURE__ */ O.jsx(Ec, {
        "data-type": "outside",
        ref: j,
        onFocus: (V) => {
          if (Ar(V, b))
            _.current?.focus();
          else {
            const P = R ? R.domReference : null;
            op(P)?.focus(), R?.closeOnFocusOut && R?.onOpenChange(!1, pn(Nd, V.nativeEvent));
          }
        }
      })]
    })]
  });
});
function jT() {
  const a = /* @__PURE__ */ new Map();
  return {
    emit(r, o) {
      a.get(r)?.forEach((c) => c(o));
    },
    on(r, o) {
      a.has(r) || a.set(r, /* @__PURE__ */ new Set()), a.get(r).add(o);
    },
    off(r, o) {
      a.get(r)?.delete(o);
    }
  };
}
const UT = /* @__PURE__ */ S.createContext(null), HT = /* @__PURE__ */ S.createContext(null), BT = () => S.useContext(UT)?.id || null, gp = (a) => {
  const r = S.useContext(HT);
  return a ?? r;
};
function LT(a, r) {
  const o = vl(dl(a));
  return a instanceof o.KeyboardEvent ? "keyboard" : a instanceof o.FocusEvent ? r || "keyboard" : "pointerType" in a ? a.pointerType || (Sc(a) ? "keyboard" : r || "mouse") : "touches" in a ? "touch" : a instanceof o.MouseEvent ? r || (a.detail === 0 ? "keyboard" : "mouse") : "";
}
const qh = 20;
let Ua = [];
function r0() {
  Ua = Ua.filter((a) => a.deref()?.isConnected);
}
function Yh(a) {
  r0(), a && Vn(a) !== "body" && (Ua.push(new WeakRef(a)), Ua.length > qh && (Ua = Ua.slice(-qh)));
}
function Gh() {
  return r0(), Ua[Ua.length - 1]?.deref();
}
function VT(a) {
  return a ? i0(a) ? a : wc(a)[0] || a : null;
}
function Xh(a) {
  if (a.hasAttribute("tabindex") && !a.hasAttribute("data-tabindex") || !a.getAttribute("role")?.includes("dialog"))
    return;
  const o = ip(a).filter((f) => {
    const d = f.getAttribute("data-tabindex") || "";
    return i0(f) || f.hasAttribute("data-tabindex") && !d.startsWith("-");
  }), c = a.getAttribute("tabindex");
  o.length === 0 ? c !== "0" && (a.setAttribute("tabindex", "0"), a.setAttribute("data-tabindex", "0")) : (c !== "-1" || a.hasAttribute("data-tabindex") && a.getAttribute("data-tabindex") !== "-1") && (a.setAttribute("tabindex", "-1"), a.setAttribute("data-tabindex", "-1"));
}
function qT(a) {
  const {
    context: r,
    children: o,
    disabled: c = !1,
    initialFocus: f = !0,
    returnFocus: d = !0,
    explicitReturnFocus: m,
    restoreFocus: p = !1,
    modal: h = !0,
    closeOnFocusOut: y = !0,
    openInteractionType: b = "",
    nextFocusableElement: g,
    previousFocusableElement: x,
    beforeContentFocusGuardRef: q,
    externalTree: j,
    getInsideElements: Y
  } = a, _ = r.useState("open"), R = r.useState("domReferenceElement"), M = r.useState("floatingElement"), {
    events: F,
    dataRef: A
  } = r.context, N = Ae(() => A.current.floatingContext?.nodeId), Q = f === !1, L = Dh(R) && Q, V = pi(f), P = pi(d), Z = pi(m), K = pi(b), te = pi(_), fe = gp(j), ae = vp(), oe = S.useRef(!1), I = S.useRef(!1), ce = S.useRef(!1), ne = S.useRef(null), ie = S.useRef(""), W = S.useRef(""), ze = S.useRef(null), pe = S.useRef(null), De = Jl(ze, q, ae?.beforeInsideRef), E = Jl(pe, ae?.afterInsideRef), U = yu(), le = yu(), re = Zd(), me = ae != null, ue = _h(M), ye = Ae((je = ue) => je ? wc(je) : []), se = Ae(() => Y?.().filter((je) => je != null) ?? []);
  S.useEffect(() => {
    if (c || !h)
      return;
    function je(be) {
      be.key === "Tab" && rt(ue, Ol(Dt(ue))) && ye().length === 0 && !L && vT(be);
    }
    const Xe = Dt(ue);
    return mt(Xe, "keydown", je);
  }, [c, ue, h, L, ye]), S.useEffect(() => {
    if (c || !_)
      return;
    const je = Dt(ue);
    function Xe() {
      ce.current = !1;
    }
    function be(Be) {
      const Te = dl(Be), Ie = se(), Re = rt(M, Te) || rt(R, Te) || rt(ae?.portalNode, Te) || Ie.some((at) => at === Te || rt(at, Te));
      ce.current = !Re, W.current = Be.pointerType || "keyboard", hT(Te, `[${fp}]`) && (I.current = !0, le.start(0, () => {
        I.current = !1;
      }));
    }
    function _e() {
      W.current = "keyboard";
    }
    return Si(
      mt(je, "pointerdown", be, !0),
      mt(je, "pointerup", Xe, !0),
      mt(je, "pointercancel", Xe, !0),
      mt(je, "keydown", _e, !0),
      // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups)
      // if the popup dismissed between pointerdown and pointerup.
      Xe
    );
  }, [c, M, R, ue, _, ae, le, se]), S.useEffect(() => {
    if (c || !y)
      return;
    const je = Dt(ue);
    function Xe() {
      I.current = !0, le.start(0, () => {
        I.current = !1;
      });
    }
    function be(Ie) {
      const Re = dl(Ie);
      i0(Re) && (ne.current = Re);
    }
    function _e(Ie) {
      const Re = Ie.relatedTarget, at = Ie.currentTarget, qe = dl(Ie);
      h && Re == null && qe != null && rt(M, qe) && Yh(qe), queueMicrotask(() => {
        const ft = N(), ge = r.context.triggerElements, Se = se(), St = Re?.hasAttribute(Or("focus-guard")) && [ze.current, pe.current, ae?.beforeInsideRef.current, ae?.afterInsideRef.current, ae?.beforeOutsideRef.current, ae?.afterOutsideRef.current, kl(x), kl(g)].includes(Re), Et = !(rt(R, Re) || rt(M, Re) || rt(Re, M) || rt(ae?.portalNode, Re) || Se.some((nt) => nt === Re || rt(nt, Re)) || ge.hasMatchingElement((nt) => rt(nt, Re)) || St || fe && (Mr(fe.nodesRef.current, ft).find((nt) => rt(nt.context?.elements.floating, Re) || rt(nt.context?.elements.domReference, Re)) || jh(fe.nodesRef.current, ft).find((nt) => [nt.context?.elements.floating, _h(nt.context?.elements.floating)].includes(Re) || nt.context?.elements.domReference === Re)));
        if (at === R && ue && Xh(ue), p && at !== R && !u0(qe) && Ol(je) === je.body) {
          if (sn(ue) && (ue.focus(), p === "popup")) {
            re.request(() => {
              ue.focus();
            });
            return;
          }
          const nt = ye(), Rn = ne.current, ln = (Rn && nt.includes(Rn) ? Rn : null) || nt[nt.length - 1] || ue;
          sn(ln) && ln.focus();
        }
        if (A.current.insideReactTree) {
          A.current.insideReactTree = !1;
          return;
        }
        (L || !h) && Re && Et && !I.current && // Fix React 18 Strict Mode returnFocus due to double rendering.
        // For an "untrapped" typeable combobox (input role=combobox with
        // initialFocus=false), re-opening the popup and tabbing out should still close it even
        // when the previously focused element (e.g. the next tabbable outside the popup) is
        // focused again. Otherwise, the popup remains open on the second Tab sequence:
        // click input -> Tab (closes) -> click input -> Tab.
        // Allow closing when `isUntrappedTypeableCombobox` regardless of the previously focused element.
        (L || Re !== Gh()) && (oe.current = !0, r.setOpen(!1, pn(Nd, Ie)));
      });
    }
    function Be() {
      ce.current || (A.current.insideReactTree = !0, U.start(0, () => {
        A.current.insideReactTree = !1;
      }));
    }
    const Te = sn(R) ? R : null;
    if (!(!M && !Te))
      return Si(Te && mt(Te, "focusout", _e), Te && mt(Te, "pointerdown", Xe), M && mt(M, "focusin", be), M && mt(M, "focusout", _e), M && ae && mt(M, "focusout", Be, !0));
  }, [c, R, M, ue, h, fe, ae, r, y, p, ye, L, N, A, U, le, re, g, x, se]), S.useEffect(() => {
    if (c || !M || !_)
      return;
    const je = Array.from(ae?.portalNode?.querySelectorAll(`[${Or("portal")}]`) || []), be = (fe ? jh(fe.nodesRef.current, N()) : []).find((at) => Dh(at.context?.elements.domReference || null))?.context?.elements.domReference, Be = [...[M, ...je, ze.current, pe.current, ae?.beforeOutsideRef.current, ae?.afterOutsideRef.current, ...se()], be, kl(x), kl(g), L ? R : null].filter((at) => at != null), Te = Vh(Be, {
      ariaHidden: h || L,
      mark: !1
    }), Ie = [M, ...je].filter((at) => at != null), Re = Vh(Ie);
    return () => {
      Re(), Te();
    };
  }, [_, c, R, M, h, ae, L, fe, N, g, x, se]), Oe(() => {
    if (!_ || c || !sn(ue))
      return;
    ie.current = "", W.current = "";
    const je = Dt(ue), Xe = Ol(je);
    queueMicrotask(() => {
      const be = V.current, _e = typeof be == "function" ? be(K.current || "") : be;
      if (_e === void 0 || _e === !1 || rt(ue, Xe))
        return;
      let Te = null;
      const Ie = () => (Te == null && (Te = ye(ue)), Te[0] || ue);
      let Re;
      _e === !0 || _e === null ? Re = Ie() : Re = kl(_e), Re = Re || Ie();
      const at = rt(ue, Ol(je)), qe = A.current.openEvent, ft = qe?.type === "mousedown" && Sc(qe);
      pd(Re, {
        sync: ft,
        preventScroll: Re === ue,
        shouldFocus() {
          if (!te.current)
            return !1;
          if (at)
            return !0;
          const ge = Ol(je);
          return !(ge !== Re && rt(ue, ge));
        }
      });
    });
  }, [c, _, ue, ye, V, K, te, A]);
  const ve = S.useRef(null);
  Oe(() => {
    if (c || !ue) {
      ve.current = null;
      return;
    }
    ve.current && (ve.current.cancelled = !0, ve.current = null);
    const je = Dt(ue), Xe = Ol(je), be = K.current == null;
    Yh(Xe);
    function _e(Te) {
      if (Te.open || (ie.current = LT(Te.nativeEvent, W.current)), (Te.reason === Nd && Te.triggerElement?.hasAttribute(Or("focus-guard")) || Te.reason === lE && Te.nativeEvent.type === "mouseleave") && (oe.current = !0), Te.reason === q2)
        if (Te.nested)
          oe.current = !1;
        else if (Sc(Te.nativeEvent) || P2(Te.nativeEvent))
          oe.current = !1;
        else {
          let Ie = !1;
          Dt(ue).createElement("div").focus({
            get preventScroll() {
              return Ie = !0, !1;
            }
          }), Ie ? oe.current = !1 : oe.current = !0;
        }
    }
    F.on("openchange", _e);
    function Be(Te) {
      const Ie = P.current;
      let Re = typeof Ie == "function" ? Ie(Te) : Ie;
      if (Re === void 0 || Re === !1)
        return null;
      Re === null && (Re = !0);
      const at = R?.isConnected ? R : null, qe = Xe?.isConnected && Vn(Xe) !== "body" ? Xe : null;
      let ft = be ? qe || at : at || qe;
      return ft || (ft = Gh() || null), typeof Re == "boolean" ? ft : kl(Re) || ft || null;
    }
    return () => {
      F.off("openchange", _e);
      const Te = Ol(je), Ie = se(), Re = rt(M, Te) || Ie.some((Se) => Se === Te || rt(Se, Te)) || fe && Mr(fe.nodesRef.current, N(), !1).some((Se) => rt(Se.context?.elements.floating, Te)), at = P.current, qe = ie.current, ft = Be(qe), ge = {
        cancelled: !1
      };
      ve.current = ge, queueMicrotask(() => {
        ve.current === ge && (ve.current = null);
        const Se = VT(ft), St = (
          // eslint-disable-next-line react-hooks/exhaustive-deps
          Z.current ?? typeof at != "boolean"
        );
        if (!ge.cancelled && at && !oe.current && sn(Se) && // If the focus moved somewhere else after mount, avoid returning focus
        // since it likely entered a different element which should be
        // respected: https://github.com/floating-ui/floating-ui/issues/2607
        (!(!St && Se !== Te && Te !== je.body) || Re)) {
          const Et = {
            preventScroll: !0
          };
          qe === "keyboard" && (Et.focusVisible = !0), Se.focus(Et);
        }
        oe.current = !1;
      });
    };
  }, [c, M, ue, P, Z, K, F, fe, R, N, se]), Oe(() => {
    if (!xi || _ || !M)
      return;
    const je = Ol(Dt(M));
    !sn(je) || !a0(je) || rt(M, je) && je.blur();
  }, [_, M]), Oe(() => {
    if (!(c || !ae))
      return ae.setFocusManagerState({
        modal: h,
        closeOnFocusOut: y,
        open: _,
        onOpenChange: r.setOpen,
        domReference: R
      }), () => {
        ae.setFocusManagerState(null);
      };
  }, [c, ae, h, _, r, y, R]), Oe(() => {
    if (!(c || !ue))
      return Xh(ue), () => {
        queueMicrotask(r0);
      };
  }, [c, ue]);
  const tt = !c && (h ? !L : !0) && (me || h);
  return /* @__PURE__ */ O.jsxs(S.Fragment, {
    children: [tt && /* @__PURE__ */ O.jsx(Ec, {
      "data-type": "inside",
      ref: De,
      onFocus: (je) => {
        if (h) {
          const Xe = ye();
          pd(Xe[Xe.length - 1]);
        } else ae?.portalNode && (oe.current = !1, Ar(je, ae.portalNode) ? op(R)?.focus() : kl(x ?? ae.beforeOutsideRef)?.focus());
      }
    }), o, tt && /* @__PURE__ */ O.jsx(Ec, {
      "data-type": "inside",
      ref: E,
      onFocus: (je) => {
        h ? pd(ye()[0]) : ae?.portalNode && (y && (oe.current = !0), Ar(je, ae.portalNode) ? cp(R)?.focus() : kl(g ?? ae.afterOutsideRef)?.focus());
      }
    })]
  });
}
function YT(a, r = {}) {
  const {
    enabled: o = !0,
    event: c = "click",
    toggle: f = !0,
    ignoreMouse: d = !1,
    stickIfOpen: m = !0,
    touchOpenDelay: p = 0,
    reason: h = Id
  } = r, y = a.context.dataRef, b = S.useRef(void 0), g = Zd(), x = yu(), q = S.useMemo(() => {
    function j(_, R, M, F) {
      const A = pn(h, R, M);
      _ && F === "touch" && p > 0 ? x.start(p, () => {
        a.setOpen(!0, A);
      }) : a.setOpen(_, A);
    }
    function Y(_, R, M) {
      const F = y.current.openEvent, A = a.select("domReferenceElement") !== R;
      return _ && A || !_ || !f ? !0 : F && (typeof m == "function" ? m() : m) ? !M(F.type) : !1;
    }
    return {
      onPointerDown(_) {
        b.current = vd(_.pointerType) && P2(_.nativeEvent) ? "virtual" : _.pointerType;
      },
      onMouseDown(_) {
        const R = b.current, M = _.nativeEvent, F = a.select("open");
        if (_.button !== 0 || c === "click" || vd(R) && d)
          return;
        const A = Y(F, _.currentTarget, (V) => V === "click" || V === "mousedown"), N = dl(M), Q = a0(N);
        if (Q || R === "virtual") {
          j(A, M, Q ? N : _.currentTarget, R);
          return;
        }
        const L = _.currentTarget;
        g.request(() => {
          j(A, M, L, R);
        });
      },
      onClick(_) {
        if (c === "mousedown-only")
          return;
        const R = b.current;
        if (c === "mousedown" && R) {
          b.current = void 0;
          return;
        }
        if (vd(R) && d)
          return;
        const M = a.select("open"), F = Y(M, _.currentTarget, (A) => A === "click" || A === "mousedown" || A === "keydown" || A === "keyup");
        j(F, _.nativeEvent, _.currentTarget, R);
      },
      onKeyDown() {
        b.current = void 0;
      }
    };
  }, [y, c, d, h, a, m, f, g, x, p]);
  return S.useMemo(() => o ? {
    reference: q
  } : Yt, [o, q]);
}
function GT() {
  return !1;
}
function XT(a) {
  return {
    escapeKey: typeof a == "boolean" ? a : a?.escapeKey ?? !1,
    outsidePress: typeof a == "boolean" ? a : a?.outsidePress ?? !0
  };
}
function QT(a, r = {}) {
  const {
    enabled: o = !0,
    escapeKey: c = !0,
    outsidePress: f = !0,
    outsidePressEvent: d = "sloppy",
    referencePress: m = GT,
    bubbles: p,
    externalTree: h
  } = r, y = a.useState("open"), b = a.useState("floatingElement"), {
    dataRef: g,
    events: x
  } = a.context, q = gp(h), j = Ae(typeof f == "function" ? f : () => !1), Y = typeof f == "function" ? j : f, _ = Y !== !1, R = Ae(() => d), {
    escapeKey: M,
    outsidePress: F
  } = XT(p), A = S.useRef(!1), N = S.useRef(!1), Q = S.useRef(!1), L = S.useRef(!1), V = S.useRef(!1), P = S.useRef(""), Z = S.useRef(null), K = yu(), te = yu(), fe = yu(), ae = Ae(() => {
    te.clear(), g.current.insideReactTree = !1;
  }), oe = Ae((E) => {
    const U = g.current.floatingContext?.nodeId;
    return (q ? Mr(q.nodesRef.current, U) : []).some((re) => re.context?.open && !re.context.dataRef.current[E]);
  }), I = Ae((E) => gd(E, a.select("floatingElement")) || gd(E, a.select("domReferenceElement"))), ce = Ae((E) => {
    m() && a.setOpen(!1, pn(Id, E.nativeEvent));
  }), ne = Ae((E) => {
    if (!y || !o || !c || E.key !== "Escape")
      return;
    const U = gT(E) ? E.nativeEvent : E;
    if (V.current || U.isComposing || !M && oe("__escapeKeyBubbles"))
      return;
    const le = pn(uE, U);
    a.setOpen(!1, le), le.isCanceled || E.preventDefault(), !M && !le.isPropagationAllowed && E.stopPropagation();
  }), ie = Ae(() => {
    g.current.insideReactTree = !0, te.start(0, ae);
  }), W = Ae((E) => {
    if (!y || !o || E.button !== 0)
      return;
    const U = dl(E.nativeEvent);
    rt(a.select("floatingElement"), U) && (A.current || (A.current = !0, N.current = !1));
  }), ze = Ae((E) => {
    !y || !o || (E.defaultPrevented || E.nativeEvent.defaultPrevented) && A.current && (N.current = !0);
  });
  S.useEffect(() => {
    function E(U) {
      U.open || (L.current = !1);
    }
    return x.on("openchange", E), () => {
      x.off("openchange", E);
    };
  }, [x]), S.useEffect(() => ae, [ae]), S.useEffect(() => {
    if (!y || !o)
      return y || (L.current = !1, V.current = !1, P.current = "", Z.current = null), ae;
    g.current.__escapeKeyBubbles = M, g.current.__outsidePressBubbles = F;
    const E = new Su(), U = Dt(b);
    function le() {
      fe.clear(), V.current = !0;
    }
    function re() {
      V.current = !0, fe.start(
        // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
        // Only apply to WebKit for the test to remain 0ms.
        xi ? 5 : 0,
        () => {
          V.current = !1;
        }
      );
    }
    function me() {
      Q.current = !0, E.start(0, () => {
        Q.current = !1;
      });
    }
    function ue() {
      A.current = !1, N.current = !1;
    }
    function ye() {
      const ge = P.current, Se = ge === "pen" || !ge ? "mouse" : ge, St = R(), Et = typeof St == "function" ? St() : St;
      return typeof Et == "string" ? Et : Et[Se];
    }
    function se(ge) {
      const Se = ye();
      return Se === "intentional" && ge.type !== "click" || Se === "sloppy" && ge.type === "click";
    }
    function ve(ge) {
      const Se = g.current.floatingContext?.nodeId, St = q && Mr(q.nodesRef.current, Se).some((Et) => gd(ge, Et.context?.elements.floating));
      return I(ge) || St;
    }
    function tt(ge) {
      if (se(ge)) {
        ge.type !== "click" && !I(ge) && (E.clear(), Q.current = !1), ae();
        return;
      }
      if (g.current.insideReactTree) {
        ae();
        return;
      }
      const Se = dl(ge), St = `[${Or("inert")}]`, Et = yi(Se) ? Se.getRootNode() : null, nt = Array.from((bu(Et) ? Et : Dt(a.select("floatingElement"))).querySelectorAll(St)), Rn = a.context.triggerElements;
      if (Se && (Rn.hasElement(Se) || Rn.hasMatchingElement((an) => rt(an, Se))))
        return;
      let ln = yi(Se) ? Se : null;
      for (; ln && !fd(ln); ) {
        const an = RE(ln);
        if (fd(an) || !yi(an))
          break;
        ln = an;
      }
      if (!(nt.length && yi(Se) && !yT(Se) && // Clicked on a direct ancestor (e.g. FloatingOverlay).
      !rt(Se, a.select("floatingElement")) && // If the target root element contains none of the markers, then the
      // element was injected after the floating element rendered.
      nt.every((an) => !rt(ln, an)))) {
        if (sn(Se) && !("touches" in ge)) {
          const an = fd(Se), $n = zc(Se), Ml = /auto|scroll/, Va = an || Ml.test($n.overflowX), Pl = an || Ml.test($n.overflowY), Wl = Va && Se.clientWidth > 0 && Se.scrollWidth > Se.clientWidth, Ci = Pl && Se.clientHeight > 0 && Se.scrollHeight > Se.clientHeight, Zt = $n.direction === "rtl", Eu = Ci && (Zt ? ge.offsetX <= Se.offsetWidth - Se.clientWidth : ge.offsetX > Se.clientWidth), gl = Wl && ge.offsetY > Se.clientHeight;
          if (Eu || gl)
            return;
        }
        if (!ve(ge)) {
          if (ye() === "intentional") {
            if (ge.detail !== 0 && !Sc(ge) && !L.current)
              return;
            if (Q.current) {
              E.clear(), Q.current = !1;
              return;
            }
          }
          typeof Y == "function" && !Y(ge) || oe("__outsidePressBubbles") || (a.setOpen(!1, pn(q2, ge)), ae());
        }
      }
    }
    function je(ge) {
      ye() !== "sloppy" || ge.pointerType === "touch" || !a.select("open") || !o || I(ge) || tt(ge);
    }
    function Xe(ge) {
      if (ye() !== "sloppy" || !a.select("open") || !o || I(ge))
        return;
      const Se = ge.touches[0];
      Se && (Z.current = {
        startTime: Date.now(),
        startX: Se.clientX,
        startY: Se.clientY,
        dismissOnTouchEnd: !1,
        dismissOnMouseDown: !0
      }, K.start(1e3, () => {
        Z.current && (Z.current.dismissOnTouchEnd = !1, Z.current.dismissOnMouseDown = !1);
      }));
    }
    function be(ge, Se) {
      const St = dl(ge);
      if (!St)
        return;
      const Et = mt(St, ge.type, () => {
        Se(ge), Et();
      });
    }
    function _e(ge) {
      P.current = "touch", be(ge, Xe);
    }
    function Be(ge) {
      K.clear(), ge.type === "pointerdown" && (ge.button === 0 && (L.current = !0), P.current = ge.pointerType), !(ge.type === "mousedown" && Z.current && !Z.current.dismissOnMouseDown) && be(ge, (Se) => {
        Se.type === "pointerdown" ? je(Se) : tt(Se);
      });
    }
    function Te(ge) {
      if (ge.type === "pointercancel" && (L.current = !1), !A.current)
        return;
      const Se = N.current;
      if (ue(), ye() === "intentional") {
        if (ge.type === "pointercancel") {
          Se && me();
          return;
        }
        if (!ve(ge)) {
          if (Se) {
            me();
            return;
          }
          typeof Y == "function" && !Y(ge) || (E.clear(), Q.current = !0, ae());
        }
      }
    }
    function Ie(ge) {
      if (ye() !== "sloppy" || !Z.current || I(ge))
        return;
      const Se = ge.touches[0];
      if (!Se)
        return;
      const St = Math.abs(Se.clientX - Z.current.startX), Et = Math.abs(Se.clientY - Z.current.startY), nt = Math.sqrt(St * St + Et * Et);
      nt > 5 && (Z.current.dismissOnTouchEnd = !0), nt > 10 && (tt(ge), K.clear(), Z.current = null);
    }
    function Re(ge) {
      be(ge, Ie);
    }
    function at(ge) {
      ye() !== "sloppy" || !Z.current || I(ge) || (Z.current.dismissOnTouchEnd && tt(ge), K.clear(), Z.current = null);
    }
    function qe(ge) {
      be(ge, at);
    }
    const ft = Si(c && Si(mt(U, "keydown", ne), mt(U, "compositionstart", le), mt(U, "compositionend", re)), _ && Si(mt(U, "click", Be, !0), mt(U, "pointerdown", Be, !0), mt(U, "pointerup", Te, !0), mt(U, "pointercancel", Te, !0), mt(U, "mousedown", Be, !0), mt(U, "mouseup", Te, !0), mt(U, "touchstart", _e, {
      capture: !0,
      passive: !0
    }), mt(U, "touchmove", Re, {
      capture: !0,
      passive: !0
    }), mt(U, "touchend", qe, {
      capture: !0,
      passive: !0
    })));
    return () => {
      ft(), E.clear(), ue(), Q.current = !1;
    };
  }, [g, b, c, _, Y, y, o, M, F, ne, ae, R, oe, I, q, a, K, fe]);
  const pe = S.useMemo(() => ({
    onKeyDown: ne,
    onPointerDown: ce,
    onClick: ce
  }), [ne, ce]), De = S.useMemo(() => ({
    onKeyDown: ne,
    // `onMouseDown` may be blocked if `event.preventDefault()` is called in
    // `onPointerDown`, such as with <NumberField.ScrubArea>.
    // See https://github.com/mui/base-ui/pull/3379
    onPointerDown: ze,
    onMouseDown: ze,
    onClickCapture: ie,
    onMouseDownCapture(E) {
      ie(), W(E);
    },
    onPointerDownCapture(E) {
      ie(), W(E);
    },
    onMouseUpCapture: ie,
    onTouchEndCapture: ie,
    onTouchMoveCapture: ie
  }), [ne, ie, W, ze]);
  return S.useMemo(() => o ? {
    reference: pe,
    floating: De,
    trigger: pe
  } : {}, [o, pe, De]);
}
function KT(a) {
  const {
    popupStore: r,
    treatPopupAsFloatingElement: o = !1,
    floatingRootContext: c,
    floatingId: f,
    nested: d,
    onOpenChange: m
  } = a, p = r.useState("open"), h = r.useState("activeTriggerElement"), y = r.useState(o ? "popupElement" : "positionerElement"), b = m;
  return r.useSyncedValue("floatingId", f), Oe(() => {
    const g = {
      open: p,
      floatingId: f,
      referenceElement: h,
      floatingElement: y
    };
    yi(h) && (g.domReferenceElement = h), c.state.positionReference === c.state.referenceElement && (g.positionReference = h), c.update(g);
  }, [p, f, h, y, c]), c.context.onOpenChange = b, c.context.nested = d, c;
}
function IT(a) {
  const {
    open: r,
    ref: o,
    preventUnmountOnClose: c,
    setPreventUnmountOnClose: f,
    onUnmount: d,
    animateInitialOpen: m
  } = a, p = Ae(f), {
    mounted: h,
    setMounted: y,
    transitionStatus: b
  } = Ac(r, !1, !1, m), g = r ? !1 : c;
  Oe(() => {
    r && p(!1);
  }, [r, p]);
  const x = S.useRef(h), q = S.useRef(!1), j = V2(), Y = () => {
    x.current = !1, y(!1), d();
  };
  Oe(() => {
    x.current = h, q.current && (q.current = !1, !r && h && Y());
  });
  const _ = Ae(() => {
    if (x.current) {
      if (r) {
        q.current = !0, j();
        return;
      }
      Y();
    }
  });
  return Ur({
    enabled: h && !r && !g,
    open: r,
    ref: o,
    onComplete() {
      r || _();
    }
  }), {
    mounted: h,
    transitionStatus: b,
    preventUnmountingOnClose: g,
    forceUnmount: _
  };
}
const ZT = {
  tabIndex: -1,
  [Md]: ""
};
function kT(a) {
  return (r) => r === "touch" ? a.current : !0;
}
function JT(a, r = !1) {
  const o = Kd(), c = BT() != null, f = Ln(() => a(o, c)).current;
  return KT({
    popupStore: f,
    treatPopupAsFloatingElement: r,
    floatingRootContext: f.state.floatingRootContext,
    floatingId: o,
    nested: c,
    onOpenChange: f.setOpen
  }), f;
}
function FT({
  handle: a,
  store: r
}) {
  return Oe(() => a.attachStore(r), [a, r]), null;
}
function Qh(a) {
  const r = a.context.triggerElements.size;
  a.select("open") && a.state.triggerCount !== r && a.set("triggerCount", r);
}
function PT(a, r) {
  const o = S.useRef(null);
  return Ae((c) => {
    const f = o.current;
    if (f !== null) {
      if (f.element === c && f.store === r && f.id === a)
        return;
      o.current = null;
      const d = f.store;
      d.context.triggerElements.getById(f.id) === f.element && (d.context.triggerElements.delete(f.id), Qh(d));
    }
    c !== null && a !== void 0 && (o.current = {
      store: r,
      id: a,
      element: c
    }, r.context.triggerElements.add(a, c), Qh(r));
  });
}
function WT(a, r, o, c = !1) {
  let f = a.preventUnmountingOnClose;
  r ? f = !1 : c && (f = !0);
  const d = o?.id ?? null;
  let m = a.activeTriggerId, p = a.activeTriggerElement;
  return (d || r) && (m = d, p = o ?? null), {
    open: r,
    preventUnmountingOnClose: f,
    activeTriggerId: m,
    activeTriggerElement: p,
    // An open request without a trigger (a handle's `open(null)` or `openWithPayload()`) must not
    // be reassociated with a lone registered trigger later on. Controlled and default opens never
    // pass through here, so they keep claiming a lone trigger. A close request keeps the flag: a
    // controlled root may decline it and stay open, so the Root clears the flag only once the
    // popup is effectively closed.
    openedWithoutTrigger: r ? o == null : a.openedWithoutTrigger
  };
}
function $T(a, r, o, c) {
  const f = o.useState("isMountedByTrigger", a), d = PT(a, o), m = Ae((h) => {
    const y = o.select("open"), b = o.select("activeTriggerId");
    if (b === a) {
      const g = {
        activeTriggerElement: h,
        ...y ? c : null
      };
      o.update(g);
      return;
    }
    if (b == null && y && !o.state.openedWithoutTrigger) {
      const g = {
        activeTriggerId: a ?? null,
        activeTriggerElement: h,
        ...c
      };
      o.update(g);
    }
  }), p = Ae((h) => {
    d(h), h && m(h);
  });
  return Oe(() => (p(r.current), () => p(null)), [p, r, o, a]), Oe(() => {
    if (f) {
      const h = {
        activeTriggerElement: r.current,
        ...c
      };
      o.update(h);
    }
  }, [f, o, r, ...Object.values(c)]), {
    registerTrigger: p,
    isMountedByThisTrigger: f
  };
}
function ex(a, r = {}) {
  const {
    closeOnActiveTriggerUnmount: o = !1
  } = r, c = S.useRef(null), f = a.useState("open"), d = a.useState("triggerCount"), m = a.useState("activeTriggerId"), p = a.useState("activeTriggerElement");
  Oe(() => {
    if (!f) {
      c.current = null, a.state.triggerCount !== 0 && a.set("triggerCount", 0), a.state.openedWithoutTrigger && a.set("openedWithoutTrigger", !1);
      return;
    }
    const h = a.context.triggerElements.size, y = {};
    a.state.triggerCount !== h && (y.triggerCount = h);
    const b = a.select("activeTriggerId");
    let g = null;
    if (b) {
      const x = a.context.triggerElements.getById(b);
      if (x)
        c.current = b, x !== a.state.activeTriggerElement && (y.activeTriggerElement = x);
      else {
        for (const [q, j] of a.context.triggerElements.entries())
          if (j === a.state.activeTriggerElement) {
            y.activeTriggerId = q, y.activeTriggerElement = j, c.current = q;
            break;
          }
        y.activeTriggerId === void 0 && (c.current === b ? g = b : c.current = null);
      }
    } else
      c.current = null;
    if (!g && !b && !a.state.openedWithoutTrigger && h === 1) {
      const x = a.context.triggerElements.entries().next();
      if (!x.done) {
        const [q, j] = x.value;
        y.activeTriggerId = q, y.activeTriggerElement = j, c.current = q;
      }
    }
    (y.triggerCount !== void 0 || y.activeTriggerId !== void 0 || y.activeTriggerElement !== void 0) && a.update(y), g && o && queueMicrotask(() => {
      if (a.select("open") && a.select("activeTriggerId") === g && !a.context.triggerElements.getById(g)) {
        const x = pn(wr);
        a.setOpen(!1, x), x.isCanceled || a.update({
          activeTriggerId: null,
          activeTriggerElement: null
        });
      }
    });
  }, [f, a, d, m, p, o]);
}
function tx(a, r, o, c) {
  const {
    mounted: f,
    transitionStatus: d,
    forceUnmount: m
  } = IT({
    open: a,
    ref: r.context.popupRef,
    preventUnmountOnClose: r.useState("preventUnmountingOnClose"),
    setPreventUnmountOnClose: (p) => r.set("preventUnmountingOnClose", p),
    animateInitialOpen: c,
    onUnmount() {
      r.update({
        activeTriggerId: null,
        activeTriggerElement: null,
        mounted: !1,
        preventUnmountingOnClose: !1
      }), r.context.onOpenChangeComplete?.(!1);
    }
  });
  return Ln(() => (r.set("mounted", f), null)), r.useSyncedValues({
    mounted: f,
    transitionStatus: d
  }), {
    forceUnmount: m,
    transitionStatus: d
  };
}
function nx(a, r) {
  a.useSyncedValues(r), Oe(() => () => {
    a.update({
      activeTriggerProps: Yt,
      inactiveTriggerProps: Yt,
      popupProps: Yt
    });
  }, [a]);
}
function lx(a, r) {
  Oe(() => {
    !r && a.state.openMethod !== null && a.set("openMethod", null);
  }, [r, a]), Oe(() => () => {
    a.state.openMethod !== null && a.set("openMethod", null);
  }, [a]);
}
class ax {
  idMap = /* @__PURE__ */ new Map();
  /**
   * Adds a trigger element with the given ID.
   *
   * Note: The provided element is assumed to not be registered under multiple IDs.
   */
  add(r, o) {
    this.idMap.set(r, o);
  }
  /**
   * Removes the trigger element with the given ID.
   */
  delete(r) {
    this.idMap.delete(r);
  }
  /**
   * Whether the given element is registered as a trigger.
   */
  hasElement(r) {
    for (const o of this.idMap.values())
      if (o === r)
        return !0;
    return !1;
  }
  /**
   * Whether there is a registered trigger element matching the given predicate.
   */
  hasMatchingElement(r) {
    for (const o of this.idMap.values())
      if (r(o))
        return !0;
    return !1;
  }
  /**
   * Returns the trigger element associated with the given ID, or undefined if no such element exists.
   */
  getById(r) {
    return this.idMap.get(r);
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
var bd = { exports: {} }, Sd = {};
var Kh;
function ux() {
  if (Kh) return Sd;
  Kh = 1;
  var a = Dr();
  function r(g, x) {
    return g === x && (g !== 0 || 1 / g === 1 / x) || g !== g && x !== x;
  }
  var o = typeof Object.is == "function" ? Object.is : r, c = a.useState, f = a.useEffect, d = a.useLayoutEffect, m = a.useDebugValue;
  function p(g, x) {
    var q = x(), j = c({ inst: { value: q, getSnapshot: x } }), Y = j[0].inst, _ = j[1];
    return d(
      function() {
        Y.value = q, Y.getSnapshot = x, h(Y) && _({ inst: Y });
      },
      [g, q, x]
    ), f(
      function() {
        return h(Y) && _({ inst: Y }), g(function() {
          h(Y) && _({ inst: Y });
        });
      },
      [g]
    ), m(q), q;
  }
  function h(g) {
    var x = g.getSnapshot;
    g = g.value;
    try {
      var q = x();
      return !o(g, q);
    } catch {
      return !0;
    }
  }
  function y(g, x) {
    return x();
  }
  var b = typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u" ? y : p;
  return Sd.useSyncExternalStore = a.useSyncExternalStore !== void 0 ? a.useSyncExternalStore : b, Sd;
}
var Ih;
function mp() {
  return Ih || (Ih = 1, bd.exports = ux()), bd.exports;
}
var o0 = mp(), Ed = { exports: {} }, Td = {};
var Zh;
function ix() {
  if (Zh) return Td;
  Zh = 1;
  var a = Dr(), r = mp();
  function o(y, b) {
    return y === b && (y !== 0 || 1 / y === 1 / b) || y !== y && b !== b;
  }
  var c = typeof Object.is == "function" ? Object.is : o, f = r.useSyncExternalStore, d = a.useRef, m = a.useEffect, p = a.useMemo, h = a.useDebugValue;
  return Td.useSyncExternalStoreWithSelector = function(y, b, g, x, q) {
    var j = d(null);
    if (j.current === null) {
      var Y = { hasValue: !1, value: null };
      j.current = Y;
    } else Y = j.current;
    j = p(
      function() {
        function R(Q) {
          if (!M) {
            if (M = !0, F = Q, Q = x(Q), q !== void 0 && Y.hasValue) {
              var L = Y.value;
              if (q(L, Q))
                return A = L;
            }
            return A = Q;
          }
          if (L = A, c(F, Q)) return L;
          var V = x(Q);
          return q !== void 0 && q(L, V) ? (F = Q, L) : (F = Q, A = V);
        }
        var M = !1, F, A, N = g === void 0 ? null : g;
        return [
          function() {
            return R(b());
          },
          N === null ? void 0 : function() {
            return R(N());
          }
        ];
      },
      [b, g, x, q]
    );
    var _ = f(y, j[0], j[1]);
    return m(
      function() {
        Y.hasValue = !0, Y.value = _;
      },
      [_]
    ), h(_), _;
  }, Td;
}
var kh;
function rx() {
  return kh || (kh = 1, Ed.exports = ix()), Ed.exports;
}
var ox = rx();
const _d = [];
let wd;
function cx() {
  return wd;
}
function sx(a) {
  _d.push(a);
}
function hp(a) {
  const r = (o, c) => {
    const f = Ln(dx).current;
    let d;
    try {
      wd = f;
      for (const m of _d)
        m.before(f);
      d = a(o, c);
      for (const m of _d)
        m.after(f);
      f.didInitialize = !0;
    } finally {
      wd = void 0;
    }
    return d;
  };
  return r.displayName = a.displayName || a.name, r;
}
function fx(a) {
  return /* @__PURE__ */ S.forwardRef(hp(a));
}
function dx() {
  return {
    didInitialize: !1
  };
}
const vx = Qd(19), gx = vx ? hx : px;
function pp(a, r, o, c, f) {
  return gx(a, r, o, c, f);
}
function mx(a, r, o, c, f) {
  const d = S.useCallback(() => r(a.getSnapshot(), o, c, f), [a, r, o, c, f]);
  return o0.useSyncExternalStore(a.subscribe, d, d);
}
sx({
  before(a) {
    a.syncIndex = 0, a.didInitialize || (a.syncTick = 1, a.syncHooks = [], a.didChangeStore = !0, a.getSnapshot = () => {
      let r = !1;
      for (let o = 0; o < a.syncHooks.length; o += 1) {
        const c = a.syncHooks[o], f = c.selector(c.store.state, c.a1, c.a2, c.a3);
        Object.is(c.value, f) || (r = !0, c.value = f);
      }
      return r && (a.syncTick += 1), a.syncTick;
    });
  },
  after(a) {
    a.syncHooks.length > 0 && (a.didChangeStore && (a.didChangeStore = !1, a.subscribe = (r) => {
      const o = /* @__PURE__ */ new Set();
      for (const f of a.syncHooks)
        o.add(f.store);
      const c = [];
      for (const f of o)
        c.push(f.subscribe(r));
      return () => {
        for (const f of c)
          f();
      };
    }), o0.useSyncExternalStore(a.subscribe, a.getSnapshot, a.getSnapshot));
  }
});
function hx(a, r, o, c, f) {
  const d = cx();
  if (!d)
    return mx(a, r, o, c, f);
  const m = d.syncIndex;
  d.syncIndex += 1;
  let p;
  return d.didInitialize ? (p = d.syncHooks[m], (p.store !== a || p.selector !== r || !Object.is(p.a1, o) || !Object.is(p.a2, c) || !Object.is(p.a3, f)) && (p.store !== a && (d.didChangeStore = !0), p.store = a, p.selector = r, p.a1 = o, p.a2 = c, p.a3 = f, p.value = r(a.getSnapshot(), o, c, f))) : (p = {
    store: a,
    selector: r,
    a1: o,
    a2: c,
    a3: f,
    value: r(a.getSnapshot(), o, c, f)
  }, d.syncHooks.push(p)), p.value;
}
function px(a, r, o, c, f) {
  return ox.useSyncExternalStoreWithSelector(a.subscribe, a.getSnapshot, a.getSnapshot, (d) => r(d, o, c, f));
}
class yx {
  /**
   * Creates a store with the given initial state, constructing the class it is called on.
   * Calling it on a generic base class (e.g. `ReactStore.create(...)`) constructs that
   * class but degrades the inferred instance type to `Store`; use `new` there instead.
   */
  static create(r) {
    return new this(r);
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
  constructor(r) {
    this.state = r, this.listeners = /* @__PURE__ */ new Set(), this.updateTick = 0;
  }
  /**
   * Registers a listener that will be called whenever the store's state changes.
   *
   * @param fn The listener function to be called on state changes.
   * @returns A function to unsubscribe the listener.
   */
  subscribe = (r) => (this.listeners.add(r), () => {
    this.listeners.delete(r);
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
  setState(r) {
    if (this.state === r)
      return;
    this.state = r, this.updateTick += 1;
    const o = this.updateTick;
    for (const c of this.listeners) {
      if (o !== this.updateTick)
        return;
      c(r);
    }
  }
  /**
   * Merges the provided changes into the current state and notifies listeners if there are changes.
   * Each value must match its state key. Pass an exact known subset rather than a broad
   * `Partial<State>`, which may contain `undefined` for required state fields.
   *
   * @param changes An object containing the changes to apply to the current state.
   */
  update(r) {
    for (const o in r)
      if (!Object.is(this.state[o], r[o])) {
        this.setState({
          ...this.state,
          ...r
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
  set(r, o) {
    Object.is(this.state[r], o) || this.setState({
      ...this.state,
      [r]: o
    });
  }
  /**
   * Gives the state a new reference and updates all registered listeners.
   */
  notifyAll() {
    const r = {
      ...this.state
    };
    this.setState(r);
  }
  use(r, o, c, f) {
    return pp(this, r, o, c, f);
  }
}
class yp extends yx {
  /**
   * Creates a new ReactStore instance.
   *
   * @param state Initial state of the store.
   * @param context Non-reactive context values.
   * @param selectors Optional selectors for use with `useState`.
   */
  constructor(r, o = {}, c) {
    super(r), this.context = o, this.selectors = c;
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
  useSyncedValue(r, o) {
    S.useDebugValue(r);
    const c = this;
    Oe(() => {
      c.state[r] !== o && c.set(r, o);
    }, [c, r, o]);
  }
  /**
   * Synchronizes a single external value into the store and
   * cleans it up (sets to `undefined`) on unmount.
   *
   * Note that the while the value in `state` is updated immediately, the value returned
   * by `useState` is updated before the next render (similarly to React's `useState`).
   */
  useSyncedValueWithCleanup(r, o) {
    const c = this;
    Oe(() => (c.state[r] !== o && c.set(r, o), () => {
      c.set(r, void 0);
    }), [c, r, o]);
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
  useSyncedValues(r) {
    const o = this, c = Object.values(r);
    Oe(() => {
      o.update(r);
    }, [o, ...c]);
  }
  /**
   * Registers a controllable prop pair (`controlled`, `defaultValue`) for a specific key. If `controlled`
   * is non-undefined, the store's state at `key` is updated to match `controlled`.
   */
  useControlledProp(r, o) {
    S.useDebugValue(r);
    const c = this, f = o !== void 0;
    Oe(() => {
      f && !Object.is(c.state[r], o) && c.setState({
        ...c.state,
        [r]: o
      });
    }, [c, r, o, f]);
  }
  /** Gets the current value from the store using a selector with the provided key.
   *
   * @param key Key of the selector to use.
   */
  select(r, o, c, f) {
    const d = this.selectors[r];
    return d(this.state, o, c, f);
  }
  /**
   * Returns a value from the store's state using a selector function.
   * Used to subscribe to specific parts of the state.
   * This methods causes a rerender whenever the selected state changes.
   *
   * @param key Key of the selector to use.
   */
  useState(r, o, c, f) {
    return S.useDebugValue(r), pp(this, this.selectors[r], o, c, f);
  }
  /**
   * Wraps a function with `useStableCallback` to ensure it has a stable reference
   * and assigns it to the context.
   *
   * @param key Key of the event callback. Must be a function in the context.
   * @param fn Function to assign.
   */
  useContextCallback(r, o) {
    S.useDebugValue(r);
    const c = Ae(o ?? Rt);
    this.context[r] = c;
  }
  /**
   * Returns a stable setter function for a specific key in the store's state.
   * It's commonly used to pass as a ref callback to React elements.
   *
   * @param key Key of the state to set.
   */
  useStateSetter(r) {
    const o = S.useRef(void 0);
    return o.current === void 0 && (o.current = (c) => {
      this.set(r, c);
    }), o.current;
  }
  /**
   * Observes changes derived from the store's selectors and calls the listener when the selected value changes.
   *
   * @param key Key of the selector to observe.
   * @param listener Listener function called when the selector result changes.
   */
  observe(r, o) {
    let c;
    typeof r == "function" ? c = r : c = this.selectors[r];
    let f = c(this.state);
    return o(f, f, this), this.subscribe((d) => {
      const m = c(d);
      if (!Object.is(f, m)) {
        const p = f;
        f = m, o(m, p, this);
      }
    });
  }
}
const bx = {
  open: (a) => a.open,
  transitionStatus: (a) => a.transitionStatus,
  domReferenceElement: (a) => a.domReferenceElement,
  referenceElement: (a) => a.positionReference ?? a.referenceElement,
  floatingElement: (a) => a.floatingElement,
  floatingId: (a) => a.floatingId
};
class Sx extends yp {
  constructor(r) {
    const {
      syncOnly: o,
      nested: c,
      onOpenChange: f,
      triggerElements: d,
      ...m
    } = r;
    super({
      ...m,
      positionReference: m.referenceElement,
      domReferenceElement: m.referenceElement
    }, {
      onOpenChange: f,
      dataRef: {
        current: {}
      },
      events: jT(),
      nested: c,
      triggerElements: d
    }, bx), this.syncOnly = o;
  }
  /**
   * Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
   */
  syncOpenEvent = (r, o) => {
    (!r || !this.state.open || // Prevent a pending hover-open from overwriting a click-open event, while allowing
    // click events to upgrade a hover-open.
    o != null && mT(o)) && (this.context.dataRef.current.openEvent = r ? o : void 0);
  };
  /**
   * Runs the root-owned side effects for an open state change.
   */
  dispatchOpenChange = (r, o) => {
    this.syncOpenEvent(r, o.event);
    const c = {
      open: r,
      reason: o.reason,
      nativeEvent: o.event,
      nested: this.context.nested,
      triggerElement: o.trigger
    };
    this.context.events.emit("openchange", c);
  };
  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  setOpen = (r, o) => {
    if (this.syncOnly) {
      this.context.onOpenChange?.(r, o);
      return;
    }
    this.dispatchOpenChange(r, o), this.context.onOpenChange?.(r, o);
  };
}
function Ex(a, r, o = !1) {
  return {
    open: !1,
    openProp: void 0,
    mounted: !1,
    transitionStatus: void 0,
    floatingRootContext: new Sx({
      open: !1,
      transitionStatus: void 0,
      floatingElement: null,
      referenceElement: null,
      triggerElements: a,
      floatingId: r,
      syncOnly: !0,
      nested: o,
      onOpenChange: void 0
    }),
    floatingId: r,
    triggerCount: 0,
    preventUnmountingOnClose: !1,
    payload: void 0,
    activeTriggerId: null,
    activeTriggerElement: null,
    openedWithoutTrigger: !1,
    triggerIdProp: void 0,
    popupElement: null,
    positionerElement: null,
    activeTriggerProps: Yt,
    inactiveTriggerProps: Yt,
    popupProps: Yt
  };
}
const Nr = (a) => a.triggerIdProp ?? a.activeTriggerId, Tc = (a) => a.openProp ?? a.open, Jh = (a) => (a.popupElement?.id ?? a.floatingId) || void 0;
function bp(a, r) {
  return r !== void 0 && Tc(a) && Nr(a) === r;
}
function Tx(a, r) {
  return bp(a, r) ? !0 : r !== void 0 && Tc(a) && Nr(a) == null && !a.openedWithoutTrigger && a.triggerCount === 1;
}
const xx = {
  open: Tc,
  mounted: (a) => a.mounted,
  // `open` is written synchronously on an open change; `mounted`/`transitionStatus` sync in a
  // layout effect. Match useTransitionStatus so a retained popup does not miss its starting phase.
  transitionStatus: (a) => Tc(a) && !a.mounted ? "starting" : a.transitionStatus,
  floatingRootContext: (a) => a.floatingRootContext,
  triggerCount: (a) => a.triggerCount,
  preventUnmountingOnClose: (a) => a.preventUnmountingOnClose,
  payload: (a) => a.payload,
  activeTriggerId: Nr,
  activeTriggerElement: (a) => a.mounted ? a.activeTriggerElement : null,
  popupId: Jh,
  /**
   * Whether the trigger with the given ID was used to open the popup.
   */
  isTriggerActive: (a, r) => r !== void 0 && Nr(a) === r,
  /**
   * Whether the popup is open and was activated by a trigger with the given ID.
   */
  isOpenedByTrigger: (a, r) => bp(a, r),
  /**
   * Whether the popup is mounted and was activated by a trigger with the given ID.
   */
  isMountedByTrigger: (a, r) => r !== void 0 && Nr(a) === r && a.mounted,
  triggerProps: (a, r) => r ? a.activeTriggerProps : a.inactiveTriggerProps,
  /**
   * Popup id for the trigger that currently owns the open popup.
   */
  triggerPopupId: (a, r) => Tx(a, r) ? Jh(a) : void 0,
  popupProps: (a) => a.popupProps,
  popupElement: (a) => a.popupElement,
  positionerElement: (a) => a.positionerElement
};
function Cx(a) {
  const r = S.useCallback((c) => a === void 0 ? Rt : a.subscribeStore(c), [a]), o = S.useCallback(() => a === void 0 ? void 0 : a.store, [a]);
  return o0.useSyncExternalStore(r, o, () => a?.serverStore);
}
const Sp = /* @__PURE__ */ S.createContext(void 0);
function Rx() {
  const a = S.useContext(Sp);
  if (a === void 0)
    throw new Error(Wn(26));
  return a;
}
const jd = "ArrowUp", Ud = "ArrowDown", Hd = "ArrowLeft", Bd = "ArrowRight", Ld = "Home", Vd = "End", Ep = /* @__PURE__ */ new Set([jd, Ud, Hd, Bd, Ld, Vd]), Tp = "Shift", Ax = [Tp, "Control", "Alt", "Meta"];
function Ox(a) {
  return sn(a) && a.tagName === "INPUT";
}
function Fh(a) {
  return !!(Ox(a) && a.selectionStart != null || sn(a) && a.tagName === "TEXTAREA");
}
function Ph(a, r, o, c) {
  if (!a || !r || !r.scrollTo)
    return;
  let f = a.scrollLeft, d = a.scrollTop;
  const m = a.clientWidth < a.scrollWidth, p = a.clientHeight < a.scrollHeight;
  if (m && c !== "vertical") {
    const h = Wh(a, r, "left"), y = dc(a), b = dc(r);
    o === "ltr" && (h + r.offsetWidth + b.scrollMarginRight > a.scrollLeft + a.clientWidth - y.scrollPaddingRight ? f = h + r.offsetWidth + b.scrollMarginRight - a.clientWidth + y.scrollPaddingRight : h - b.scrollMarginLeft < a.scrollLeft + y.scrollPaddingLeft && (f = h - b.scrollMarginLeft - y.scrollPaddingLeft)), o === "rtl" && (h - b.scrollMarginLeft < a.scrollLeft + y.scrollPaddingLeft ? f = h - b.scrollMarginLeft - y.scrollPaddingLeft : h + r.offsetWidth + b.scrollMarginRight > a.scrollLeft + a.clientWidth - y.scrollPaddingRight && (f = h + r.offsetWidth + b.scrollMarginRight - a.clientWidth + y.scrollPaddingRight));
  }
  if (p && c !== "horizontal") {
    const h = Wh(a, r, "top"), y = dc(a), b = dc(r);
    h - b.scrollMarginTop < a.scrollTop + y.scrollPaddingTop ? d = h - b.scrollMarginTop - y.scrollPaddingTop : h + r.offsetHeight + b.scrollMarginBottom > a.scrollTop + a.clientHeight - y.scrollPaddingBottom && (d = h + r.offsetHeight + b.scrollMarginBottom - a.clientHeight + y.scrollPaddingBottom);
  }
  a.scrollTo({
    left: f,
    top: d,
    behavior: "auto"
  });
}
function Wh(a, r, o) {
  const c = o === "left" ? "offsetLeft" : "offsetTop";
  let f = 0;
  for (; r.offsetParent && (f += r[c], r.offsetParent !== a); )
    r = r.offsetParent;
  return f;
}
function dc(a) {
  const r = getComputedStyle(a);
  return {
    scrollMarginTop: parseFloat(r.scrollMarginTop) || 0,
    scrollMarginRight: parseFloat(r.scrollMarginRight) || 0,
    scrollMarginBottom: parseFloat(r.scrollMarginBottom) || 0,
    scrollMarginLeft: parseFloat(r.scrollMarginLeft) || 0,
    scrollPaddingTop: parseFloat(r.scrollPaddingTop) || 0,
    scrollPaddingRight: parseFloat(r.scrollPaddingRight) || 0,
    scrollPaddingBottom: parseFloat(r.scrollPaddingBottom) || 0,
    scrollPaddingLeft: parseFloat(r.scrollPaddingLeft) || 0
  };
}
const Nx = "--nested-dialogs", zx = "data-nested-dialog-open", Mx = {
  ...J2,
  ...jr,
  nestedDialogOpen(a) {
    return a ? {
      [zx]: ""
    } : null;
  }
}, Dx = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    finalFocus: m,
    initialFocus: p,
    ...h
  } = r, y = La(), b = y.useState("descriptionElementId"), g = y.useState("disablePointerDismissal"), x = y.useState("floatingRootContext"), q = y.useState("popupProps"), j = y.useState("modal"), Y = y.useState("mounted"), _ = y.useState("nested"), R = y.useState("nestedOpenDialogCount"), M = y.useState("open"), F = y.useState("openMethod"), A = y.useState("titleElementId"), N = y.useState("transitionStatus"), Q = y.useState("role"), L = x.useState("floatingId");
  Rx(), Ur({
    open: M,
    ref: y.context.popupRef,
    onComplete() {
      M && y.context.onOpenChangeComplete?.(!0);
    }
  });
  const V = p === void 0 ? kT(y.context.popupRef) : p, P = R > 0, Z = y.useStateSetter("popupElement"), te = Nt("div", r, {
    state: {
      open: M,
      nested: _,
      transitionStatus: N,
      nestedDialogOpen: P
    },
    props: [q, {
      id: L,
      "aria-labelledby": A,
      "aria-describedby": b,
      role: Q,
      ...ZT,
      hidden: !Y,
      onKeyDown(fe) {
        Ep.has(fe.key) && fe.stopPropagation();
      },
      style: {
        [Nx]: R
      }
    }, h],
    ref: [o, y.context.popupRef, Z],
    stateAttributesMapping: Mx
  });
  return /* @__PURE__ */ O.jsx(qT, {
    context: x,
    openInteractionType: F,
    disabled: !Y,
    closeOnFocusOut: !g,
    initialFocus: V,
    returnFocus: m,
    modal: j !== !1,
    restoreFocus: "popup",
    children: te
  });
});
function xp(a) {
  return Qd(19) ? a : a ? "true" : void 0;
}
const _x = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    cutout: c,
    ...f
  } = r;
  let d;
  if (c) {
    const m = c.getBoundingClientRect();
    d = `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${m.left}px ${m.top}px,${m.left}px ${m.bottom}px,${m.right}px ${m.bottom}px,${m.right}px ${m.top}px,${m.left}px ${m.top}px)`;
  }
  return /* @__PURE__ */ O.jsx("div", {
    ref: o,
    role: "presentation",
    "data-base-ui-inert": "",
    ...f,
    style: {
      position: "fixed",
      inset: 0,
      userSelect: "none",
      WebkitUserSelect: "none",
      clipPath: d
    }
  });
}), wx = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    keepMounted: c = !1,
    ...f
  } = r, d = La(), m = d.useState("mounted"), p = d.useState("modal"), h = d.useState("open");
  return m || c ? /* @__PURE__ */ O.jsx(Sp.Provider, {
    value: c,
    children: /* @__PURE__ */ O.jsxs(wT, {
      ref: o,
      ...f,
      children: [m && p === !0 && /* @__PURE__ */ O.jsx(_x, {
        ref: d.context.internalBackdropRef,
        inert: xp(!h)
      }), r.children]
    })
  }) : null;
});
let $h = {}, e2 = {}, t2 = "";
function jc(a, r) {
  return CE(a) ? a : r;
}
function n2(a, r, o) {
  return /hidden|clip/.test(a.getComputedStyle(jc(r, o)).overflowY);
}
function jx(a) {
  if (typeof document > "u")
    return !1;
  const r = Dt(a);
  return vl(r).innerWidth - r.documentElement.clientWidth > 0;
}
function Ux(a) {
  if (!(typeof CSS < "u" && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) || typeof document > "u")
    return !1;
  const o = Dt(a), c = o.documentElement, f = o.body, d = jc(c, f), m = d.style.overflowY, p = c.style.scrollbarGutter;
  c.style.scrollbarGutter = "stable", d.style.overflowY = "scroll";
  const h = d.offsetWidth;
  d.style.overflowY = "hidden";
  const y = d.offsetWidth;
  return d.style.overflowY = m, c.style.scrollbarGutter = p, h === y;
}
function Hx(a) {
  const r = Dt(a), o = r.documentElement, c = r.body, f = jc(o, c), d = {
    overflowY: f.style.overflowY,
    overflowX: f.style.overflowX
  };
  return Object.assign(f.style, {
    overflowY: "hidden",
    overflowX: "hidden"
  }), () => {
    Object.assign(f.style, d);
  };
}
function Bx(a) {
  const r = Dt(a), o = r.documentElement, c = r.body, f = vl(o);
  let d = 0, m = 0, p = !1;
  const h = cn.create();
  if (xi && (f.visualViewport?.scale ?? 1) !== 1)
    return () => {
    };
  function y() {
    const q = f.getComputedStyle(o), j = f.getComputedStyle(c), R = (q.scrollbarGutter || "").includes("both-edges") ? "stable both-edges" : "stable";
    d = o.scrollTop, m = o.scrollLeft, $h = {
      scrollbarGutter: o.style.scrollbarGutter,
      overflowY: o.style.overflowY,
      overflowX: o.style.overflowX
    }, t2 = o.style.scrollBehavior, e2 = {
      position: c.style.position,
      height: c.style.height,
      width: c.style.width,
      boxSizing: c.style.boxSizing,
      overflowY: c.style.overflowY,
      overflowX: c.style.overflowX,
      scrollBehavior: c.style.scrollBehavior
    };
    const M = o.scrollHeight > o.clientHeight, F = o.scrollWidth > o.clientWidth, A = q.overflowY === "scroll" || j.overflowY === "scroll", N = q.overflowX === "scroll" || j.overflowX === "scroll", Q = Math.max(0, f.innerWidth - c.clientWidth), L = Math.max(0, f.innerHeight - c.clientHeight), V = parseFloat(j.marginTop) + parseFloat(j.marginBottom), P = parseFloat(j.marginLeft) + parseFloat(j.marginRight), Z = jc(o, c);
    if (p = Ux(a), p) {
      o.style.scrollbarGutter = R, Z.style.overflowY = "hidden", Z.style.overflowX = "hidden";
      return;
    }
    Object.assign(o.style, {
      scrollbarGutter: R,
      overflowY: "hidden",
      overflowX: "hidden"
    }), (M || A) && (o.style.overflowY = "scroll"), (F || N) && (o.style.overflowX = "scroll"), Object.assign(c.style, {
      position: "relative",
      height: V || L ? `calc(100dvh - ${V + L}px)` : "100dvh",
      width: P || Q ? `calc(100vw - ${P + Q}px)` : "100vw",
      boxSizing: "border-box",
      // Assign the longhands that `cleanup` restores, so nothing is left behind.
      overflowY: "hidden",
      overflowX: "hidden",
      scrollBehavior: "unset"
    }), c.scrollTop = d, c.scrollLeft = m, o.setAttribute("data-base-ui-scroll-locked", ""), o.style.scrollBehavior = "unset";
  }
  function b() {
    Object.assign(o.style, $h), Object.assign(c.style, e2), p || (o.scrollTop = d, o.scrollLeft = m, o.removeAttribute("data-base-ui-scroll-locked"), o.style.scrollBehavior = t2);
  }
  function g() {
    b(), h.request(y);
  }
  y();
  const x = mt(f, "resize", g);
  return () => {
    h.cancel(), b(), typeof f.removeEventListener == "function" && x();
  };
}
class Lx {
  lockCount = 0;
  restore = null;
  timeoutLock = Su.create();
  timeoutUnlock = Su.create();
  acquire(r) {
    return this.lockCount += 1, this.lockCount === 1 && this.restore === null && this.timeoutLock.start(0, () => this.lock(r)), this.release;
  }
  release = () => {
    this.lockCount -= 1, this.lockCount === 0 && this.restore && this.timeoutUnlock.start(0, this.unlock);
  };
  unlock = () => {
    this.lockCount === 0 && this.restore && (this.restore?.(), this.restore = null);
  };
  lock(r) {
    if (this.lockCount === 0 || this.restore !== null)
      return;
    const o = Dt(r), c = o.documentElement, f = o.body, d = vl(c);
    if (n2(d, c, f)) {
      const p = new d.MutationObserver(() => {
        n2(d, c, f) || (p.disconnect(), this.restore = null, this.lock(r));
      }), h = {
        attributes: !0
      };
      p.observe(c, h), p.observe(f, h), this.restore = () => p.disconnect();
      return;
    }
    const m = _c || !jx(r);
    this.restore = m ? Hx(r) : Bx(r);
  }
}
const Vx = new Lx();
function qx(a = !0, r = null) {
  Oe(() => {
    if (a)
      return Vx.acquire(r);
  }, [a, r]);
}
function Yx({
  store: a,
  parentContext: r,
  isDrawer: o
}) {
  const c = a.useState("open"), f = a.useState("mounted"), d = a.useState("disablePointerDismissal"), m = a.useState("modal"), p = a.useState("popupElement"), h = a.useState("floatingRootContext"), [y, b] = S.useState(0), [g, x] = S.useState(0), q = y === 0, j = QT(h, {
    outsidePressEvent() {
      return a.context.internalBackdropRef.current || a.context.backdropRef.current ? "intentional" : {
        mouse: m === "trap-focus" ? "sloppy" : "intentional",
        touch: "sloppy"
      };
    },
    outsidePress(Y) {
      if (!a.context.outsidePressEnabledRef.current || "button" in Y && Y.button !== 0)
        return !1;
      if ("touches" in Y) {
        if (Y.type === "touchend") {
          if (Y.changedTouches.length !== 1 || Y.touches.length !== 0)
            return !1;
        } else if (Y.touches.length !== 1)
          return !1;
      }
      const _ = dl(Y);
      if (q && !d) {
        if (m) {
          const R = a.context.internalBackdropRef.current, M = a.context.backdropRef.current;
          return R || M ? R === _ || M === _ || rt(_, p) && !_?.hasAttribute("data-base-ui-portal") : !0;
        }
        return !0;
      }
      return !1;
    },
    escapeKey: q
  });
  return qx(c && m === !0, p), a.useContextCallback("onNestedDialogOpen", (Y, _) => {
    !a.select("open") && !a.select("mounted") || (b(Y), x(_));
  }), Oe(() => {
    !c && !f && (b(0), x(0));
  }, [c, f]), Oe(() => (r?.onNestedDialogOpen && c && r.onNestedDialogOpen(y + 1, g + (o ? 1 : 0)), () => {
    r?.onNestedDialogOpen && c && r.onNestedDialogOpen(0, 0);
  }), [o, c, y, g, r]), nx(a, {
    // `enabled` is not passed to `useDismiss`, so its props are always defined,
    // and `trigger` is the same object as `reference`.
    activeTriggerProps: j.reference,
    inactiveTriggerProps: j.trigger,
    // DialogPopup and DrawerPopup spread `FOCUSABLE_POPUP_PROPS` directly, so
    // this only needs to carry the dismiss handlers.
    popupProps: j.floating,
    nestedOpenDialogCount: y,
    nestedOpenDrawerCount: g
  }), null;
}
const Gx = {
  ...xx,
  modal: (a) => a.modal,
  nested: (a) => a.nested,
  nestedOpenDialogCount: (a) => a.nestedOpenDialogCount,
  nestedOpenDrawerCount: (a) => a.nestedOpenDrawerCount,
  disablePointerDismissal: (a) => a.disablePointerDismissal,
  openMethod: (a) => a.openMethod,
  descriptionElementId: (a) => a.descriptionElementId,
  titleElementId: (a) => a.titleElementId,
  viewportElement: (a) => a.viewportElement,
  role: (a) => a.role
};
class Xx extends yp {
  constructor(r, o, c) {
    const f = new ax(), d = Qx(r, f, o, c);
    super(d, Kx(f), Gx);
  }
  setOpen = (r, o) => {
    o.preventUnmountOnClose = () => {
      this.set("preventUnmountingOnClose", !0);
    }, !r && o.trigger == null && this.state.activeTriggerId != null && (o.trigger = this.state.activeTriggerElement ?? void 0), this.context.onOpenChange?.(r, o), !o.isCanceled && (this.state.floatingRootContext.dispatchOpenChange(r, o), this.update(WT(this.state, r, o.trigger)));
  };
}
function Qx(a, r, o, c = !1) {
  return {
    ...Ex(r, o, c),
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
    ...a
  };
}
function Kx(a) {
  return {
    popupRef: /* @__PURE__ */ S.createRef(),
    backdropRef: /* @__PURE__ */ S.createRef(),
    internalBackdropRef: /* @__PURE__ */ S.createRef(),
    outsidePressEnabledRef: {
      current: !0
    },
    triggerElements: a,
    onOpenChange: void 0,
    onOpenChangeComplete: void 0
  };
}
function Ix(a, r) {
  const {
    children: o,
    open: c,
    defaultOpen: f = !1,
    onOpenChange: d,
    onOpenChangeComplete: m,
    disablePointerDismissal: p = !1,
    modal: h = !0,
    actionsRef: y,
    handle: b,
    triggerId: g,
    defaultTriggerId: x = null
  } = r, q = a === "drawer", j = h, Y = p, _ = "dialog", R = La(!0), M = R != null, F = {
    modal: j,
    disablePointerDismissal: Y,
    nested: M,
    role: _
  }, A = JT((Z, K) => new Xx({
    open: f,
    openProp: c,
    activeTriggerId: x,
    triggerIdProp: g,
    ...F
  }, Z, K), !0);
  A.useControlledProp("openProp", c), A.useControlledProp("triggerIdProp", g), A.useSyncedValues(F), A.useContextCallback("onOpenChange", d), A.useContextCallback("onOpenChangeComplete", m);
  const N = A.useState("open"), Q = A.useState("mounted"), L = A.useState("payload");
  lx(A, N), ex(A);
  const {
    forceUnmount: V
  } = tx(N, A);
  S.useImperativeHandle(y, () => ({
    unmount: V,
    close: () => A.setOpen(!1, pn(rE))
  }), [V, A]);
  const P = N || Q || b != null;
  return /* @__PURE__ */ O.jsxs(k2.Provider, {
    value: A,
    children: [b && /* @__PURE__ */ O.jsx(FT, {
      handle: b,
      store: A
    }), P && /* @__PURE__ */ O.jsx(Yx, {
      store: A,
      parentContext: R?.context,
      isDrawer: q
    }), typeof o == "function" ? o({
      payload: L
    }) : o]
  });
}
const Zx = hp(function(r) {
  return Ix("dialog", r);
}), kx = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    id: m,
    ...p
  } = r, h = La(), y = Pn(m);
  return h.useSyncedValueWithCleanup("titleElementId", y), Nt("h2", r, {
    ref: o,
    props: [{
      id: y
    }, p]
  });
});
function Jx(a) {
  const r = S.useRef(""), o = S.useCallback((f) => {
    f.defaultPrevented || (r.current = f.pointerType, a(f, f.pointerType));
  }, [a]);
  return {
    onClick: S.useCallback((f) => {
      if (f.detail === 0) {
        a(f, "keyboard");
        return;
      }
      "pointerType" in f ? a(f, f.pointerType) : a(f, r.current), r.current = "";
    }, [a]),
    onPointerDown: o
  };
}
function Cp(a, r) {
  const o = S.useRef(a), c = Ae(r);
  Oe(() => {
    o.current !== a && c(o.current), o.current = a;
  }, [a, c]);
}
function Fx(a, r) {
  const o = Ae((d, m) => {
    (typeof a == "function" ? a() : a) || r(m || // On iOS Safari, the hitslop around touch targets means tapping outside an element's
    // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
    // will be "" in that case.
    (_c ? "touch" : ""));
  }), {
    onClick: c,
    onPointerDown: f
  } = Jx(o);
  return S.useMemo(() => ({
    onClick: c,
    onPointerDown: f
  }), [c, f]);
}
const Px = fx(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    disabled: m = !1,
    nativeButton: p = !0,
    id: h,
    payload: y,
    handle: b,
    ...g
  } = r, x = La(!0), j = Cx(b) ?? x;
  if (!j)
    throw new Error(Wn(79));
  const Y = Pn(h), _ = j.useState("floatingRootContext"), R = j.useState("isOpenedByTrigger", Y), M = j.useState("triggerPopupId", Y), F = S.useRef(null), {
    registerTrigger: A,
    isMountedByThisTrigger: N
  } = $T(Y, F, j, {
    payload: y
  }), {
    getButtonProps: Q,
    buttonRef: L
  } = Ti({
    disabled: m,
    native: p
  }), V = YT(_), P = Fx(() => j.select("open"), (te) => {
    j.set("openMethod", te);
  }), Z = {
    disabled: m,
    open: R
  }, K = j.useState("triggerProps", N);
  return Nt("button", r, {
    state: Z,
    ref: [L, o, A, F],
    props: [V.reference, K, P, {
      [fp]: "",
      id: Y,
      "aria-haspopup": "dialog",
      "aria-expanded": R,
      "aria-controls": M
    }, g, Q],
    stateAttributesMapping: tT
  });
});
function Wx({ ...a }) {
  return /* @__PURE__ */ O.jsx(Zx, { "data-slot": "dialog", ...a });
}
function $x({ ...a }) {
  return /* @__PURE__ */ O.jsx(Px, { "data-slot": "dialog-trigger", ...a });
}
function eC({ ...a }) {
  return /* @__PURE__ */ O.jsx(wx, { "data-slot": "dialog-portal", ...a });
}
function tC({
  className: a,
  ...r
}) {
  return /* @__PURE__ */ O.jsx(
    lT,
    {
      "data-slot": "dialog-overlay",
      className: Je(
        "voxel-armory-overlay va:fixed va:inset-0 va:isolate va:z-50 va:bg-background/80 va:duration-100 va:supports-backdrop-filter:backdrop-blur-xs va:data-open:animate-in va:data-open:fade-in-0 va:data-closed:animate-out va:data-closed:fade-out-0",
        a
      ),
      ...r
    }
  );
}
function nC({
  className: a,
  children: r,
  showCloseButton: o = !0,
  variant: c = "default",
  portalContainer: f,
  ...d
}) {
  return /* @__PURE__ */ O.jsxs(eC, { container: f, children: [
    /* @__PURE__ */ O.jsx(tC, {}),
    /* @__PURE__ */ O.jsxs(
      Dx,
      {
        "data-slot": "dialog-content",
        "data-variant": c,
        className: Je(
          "va:fixed va:top-1/2 va:left-1/2 va:z-50 va:grid va:w-full va:max-w-[calc(100%-2rem)] va:-translate-x-1/2 va:-translate-y-1/2 va:gap-4 va:rounded-xl va:bg-popover va:p-4 va:text-sm va:text-popover-foreground va:ring-1 va:ring-foreground/10 va:duration-100 va:outline-none va:sm:max-w-sm va:data-open:animate-in va:data-open:fade-in-0 va:data-open:zoom-in-95 va:data-closed:animate-out va:data-closed:fade-out-0 va:data-closed:zoom-out-95",
          c === "armory" && "voxel-armory-modal",
          a
        ),
        ...d,
        children: [
          r,
          o && /* @__PURE__ */ O.jsxs(
            F2,
            {
              "data-slot": "dialog-close",
              render: /* @__PURE__ */ O.jsx(
                ja,
                {
                  variant: "ghost",
                  className: "va:absolute va:top-2 va:right-2",
                  size: "icon-sm"
                }
              ),
              children: [
                /* @__PURE__ */ O.jsx(
                  R2,
                  {}
                ),
                /* @__PURE__ */ O.jsx("span", { className: "va:sr-only", children: "Close" })
              ]
            }
          )
        ]
      }
    )
  ] });
}
function lC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "dialog-header",
      className: Je("va:flex va:flex-col va:gap-2", a),
      ...r
    }
  );
}
function aC({
  className: a,
  showCloseButton: r = !1,
  children: o,
  ...c
}) {
  return /* @__PURE__ */ O.jsxs(
    "div",
    {
      "data-slot": "dialog-footer",
      className: Je(
        "va:-mx-4 va:-mb-4 va:flex va:flex-col-reverse va:gap-2 va:rounded-b-xl va:border-t va:bg-muted/50 va:p-4 va:sm:flex-row va:sm:justify-end",
        a
      ),
      ...c,
      children: [
        o,
        r && /* @__PURE__ */ O.jsx(F2, { render: /* @__PURE__ */ O.jsx(ja, { variant: "outline" }), children: "Close" })
      ]
    }
  );
}
function uC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    kx,
    {
      "data-slot": "dialog-title",
      className: Je(
        "va:text-base va:leading-none va:font-medium",
        a
      ),
      ...r
    }
  );
}
function iC({
  className: a,
  ...r
}) {
  return /* @__PURE__ */ O.jsx(
    aT,
    {
      "data-slot": "dialog-description",
      className: Je(
        "va:text-sm va:text-muted-foreground va:*:[a]:underline va:*:[a]:underline-offset-3 va:*:[a]:hover:text-foreground",
        a
      ),
      ...r
    }
  );
}
function l2({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "empty",
      className: Je(
        "va:flex va:w-full va:min-w-0 va:flex-1 va:flex-col va:items-center va:justify-center va:gap-4 va:rounded-xl va:border-dashed va:p-6 va:text-center va:text-balance",
        a
      ),
      ...r
    }
  );
}
function a2({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "empty-header",
      className: Je("va:flex va:max-w-sm va:flex-col va:items-center va:gap-2", a),
      ...r
    }
  );
}
function u2({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "empty-title",
      className: Je(
        "va: va:text-sm va:font-medium va:tracking-tight",
        a
      ),
      ...r
    }
  );
}
function i2({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "empty-description",
      className: Je(
        "va:text-sm/relaxed va:text-muted-foreground va:[&>a]:underline va:[&>a]:underline-offset-4 va:[&>a:hover]:text-primary",
        a
      ),
      ...r
    }
  );
}
function rC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "empty-content",
      className: Je(
        "va:flex va:w-full va:max-w-sm va:min-w-0 va:flex-col va:items-center va:gap-2.5 va:text-sm va:text-balance",
        a
      ),
      ...r
    }
  );
}
function oC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "label",
    {
      "data-slot": "label",
      className: Je(
        "va:flex va:items-center va:gap-2 va:text-sm va:leading-none va:font-medium va:select-none va:group-data-[disabled=true]:pointer-events-none va:group-data-[disabled=true]:opacity-50 va:peer-disabled:cursor-not-allowed va:peer-disabled:opacity-50",
        a
      ),
      ...r
    }
  );
}
function cC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "fieldset",
    {
      "data-slot": "field-set",
      className: Je(
        "va:flex va:flex-col va:gap-4 va:has-[>[data-slot=checkbox-group]]:gap-3 va:has-[>[data-slot=radio-group]]:gap-3",
        a
      ),
      ...r
    }
  );
}
function sC({
  className: a,
  variant: r = "legend",
  ...o
}) {
  return /* @__PURE__ */ O.jsx(
    "legend",
    {
      "data-slot": "field-legend",
      "data-variant": r,
      className: Je(
        "va:mb-1.5 va:font-medium va:data-[variant=label]:text-sm va:data-[variant=legend]:text-base",
        a
      ),
      ...o
    }
  );
}
function fC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      "data-slot": "field-group",
      className: Je(
        "va:group/field-group va:@container/field-group va:flex va:w-full va:flex-col va:gap-5 va:data-[slot=checkbox-group]:gap-3 va:*:data-[slot=field-group]:gap-4",
        a
      ),
      ...r
    }
  );
}
const dC = Mc(
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
function Rp({
  className: a,
  orientation: r = "vertical",
  ...o
}) {
  return /* @__PURE__ */ O.jsx(
    "div",
    {
      role: "group",
      "data-slot": "field",
      "data-orientation": r,
      className: Je(dC({ orientation: r }), a),
      ...o
    }
  );
}
function Ap({
  className: a,
  ...r
}) {
  return /* @__PURE__ */ O.jsx(
    oC,
    {
      "data-slot": "field-label",
      className: Je(
        "va:group/field-label va:peer/field-label va:flex va:w-fit va:gap-2 va:leading-snug va:group-data-[disabled=true]/field:opacity-50 va:has-data-checked:border-primary/30 va:has-data-checked:bg-primary/5 va:has-[>[data-slot=field]]:rounded-lg va:has-[>[data-slot=field]]:border va:has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 va:has-[>[data-slot=field]]:has-[:focus-visible]:border-ring va:has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 va:has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 va:*:data-[slot=field]:p-2.5 va:dark:has-data-checked:border-primary/20 va:dark:has-data-checked:bg-primary/10",
        "va:has-[>[data-slot=field]]:w-full va:has-[>[data-slot=field]]:flex-col",
        a
      ),
      ...r
    }
  );
}
const vC = "data-valid", gC = "data-invalid", mC = {
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
}, hC = {
  valid: null,
  touched: !1,
  dirty: !1,
  filled: !1,
  focused: !1
}, pC = {
  disabled: !1,
  ...hC
}, c0 = {
  valid(a) {
    return a === null ? null : a ? {
      [vC]: ""
    } : {
      [gC]: ""
    };
  }
}, yC = {
  invalid: void 0,
  name: void 0,
  validityData: {
    state: mC,
    errors: [],
    error: "",
    value: "",
    initialValue: null
  },
  setValidityData: Rt,
  disabled: void 0,
  setTouched: Rt,
  setDirty: Rt,
  setFilled: Rt,
  setFocused: Rt,
  focusOwnerRef: {
    current: void 0
  },
  validationMode: "onSubmit",
  shouldValidateOnChange: () => !1,
  state: pC,
  registerFieldControl: Rt,
  validation: {
    getValidationProps: (a, r = Yt) => r,
    inputRef: {
      current: null
    },
    registeredInputs: /* @__PURE__ */ new Map(),
    registerInput: Rt,
    getInputControl: () => null,
    commit: async () => {
    },
    change: Rt
  }
}, bC = /* @__PURE__ */ S.createContext(yC);
function Hr(a = !0) {
  const r = S.useContext(bC);
  if (r.setValidityData === Rt && !a)
    throw new Error(Wn(28));
  return r;
}
const SC = /* @__PURE__ */ S.createContext(void 0);
function EC(a = !1) {
  const r = S.useContext(SC);
  if (!r && !a)
    throw new Error(Wn(86));
  return r;
}
const TC = /* @__PURE__ */ S.createContext({
  elementRef: {
    current: null
  },
  formRef: {
    current: {
      fields: /* @__PURE__ */ new Map()
    }
  },
  errors: {},
  clearErrors: Rt,
  validationMode: "onSubmit",
  submitCountRef: {
    current: 0
  }
});
function Op() {
  return S.useContext(TC);
}
const xC = /* @__PURE__ */ S.createContext({
  controlId: void 0,
  registerControlId: Rt,
  resetControlId: Rt,
  labelId: void 0,
  setLabelId: Rt,
  messageIds: [],
  setMessageIds: Rt,
  getDescriptionProps: (a) => a
});
function Uc() {
  return S.useContext(xC);
}
function CC(a, r, o, c = !0, f, d) {
  const [m, p] = S.useState(), h = Pn(f ? `${f}-label` : void 0), y = !!d?.trim(), g = a ?? (y ? void 0 : r) ?? m;
  return Oe(() => {
    const x = a || r || y || !c ? void 0 : RC(o.current, h);
    m !== x && p(x);
  }), g;
}
function RC(a, r) {
  const o = AC(a);
  if (o)
    return !o.id && r && (o.id = r), o.id || void 0;
}
function AC(a) {
  if (!a)
    return;
  const r = a.parentElement;
  if (r && r.tagName === "LABEL")
    return r;
  const o = a.id;
  if (o) {
    const f = a.nextElementSibling;
    if (f && f.htmlFor === o)
      return f;
  }
  const c = a.labels;
  return c && c[0];
}
function Np(a = {}) {
  const {
    id: r,
    enabled: o = !0
  } = a, {
    controlId: c,
    registerControlId: f,
    resetControlId: d
  } = Uc(), m = Pn(), p = Ln(() => /* @__PURE__ */ Symbol()), h = S.useRef(!1), y = S.useRef(!1), b = Ae(() => {
    !h.current || f === Rt || (h.current = !1, f(p.current, void 0));
  });
  return Oe(() => {
    if (!o || f === Rt) {
      b();
      return;
    }
    let g;
    if (r !== void 0)
      y.current = !0, g = r;
    else if (y.current)
      g = m;
    else {
      d();
      return;
    }
    if (g === void 0) {
      b();
      return;
    }
    h.current = !0, f(p.current, g);
  }, [r, o, f, d, m, p, b]), Oe(() => b, [b]), (o ? c : void 0) ?? r ?? m;
}
function OC(a, r) {
  return a.matches(":disabled") ? !1 : !r || a.form === r ? !0 : a.form === null && !a.hasAttribute("form");
}
const NC = /* @__PURE__ */ S.createContext({
  disabled: !1
});
function zC() {
  return S.useContext(NC);
}
function zp(a, r, o) {
  const {
    setFocused: c,
    focusOwnerRef: f
  } = Hr(), d = Ae((m) => {
    (m ? !a : f.current === d) && (f.current = m && d, c(m));
  });
  return Oe(() => {
    const m = r.current;
    return m?.getRootNode()?.activeElement === m && d(!0), () => d(!1);
  }, [a, r, d]), d;
}
function Mp(a, r, o, c, f = !0, d) {
  const {
    registerFieldControl: m
  } = Hr(), p = Ln(() => /* @__PURE__ */ Symbol());
  Oe(() => {
    const h = p.current;
    if (!f) {
      m(h, void 0);
      return;
    }
    m(h, {
      controlRef: a,
      getValue: c,
      id: r,
      name: d,
      value: o
    });
  }, [a, f, c, r, d, m, p, o]), Oe(() => {
    const h = p.current;
    return () => {
      m(h, void 0);
    };
  }, [m, p]);
}
const MC = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    id: d,
    name: m,
    value: p,
    disabled: h = !1,
    onValueChange: y,
    defaultValue: b,
    autoFocus: g = !1,
    style: x,
    ...q
  } = r, {
    state: j,
    name: Y,
    disabled: _,
    setTouched: R,
    setDirty: M,
    validityData: F,
    setFilled: A,
    validationMode: N,
    validation: Q
  } = Hr(), {
    clearErrors: L,
    elementRef: V,
    submitCountRef: P
  } = Op(), Z = _ || h, K = Y ?? m, te = {
    ...j,
    disabled: Z
  }, {
    labelId: fe
  } = Uc(), ae = Np({
    id: d
  }), oe = p !== void 0, I = p == null ? void 0 : String(p), ce = Ae(() => Q.inputRef.current?.value);
  Mp(Q.inputRef, ae, I, ce, !Z, m), Oe(() => {
    const pe = I ?? Q.inputRef.current?.value;
    pe !== void 0 && A(pe !== "");
  }, [I, b, Q.inputRef, A]), Cp(I, () => {
    I !== void 0 && (L(K), M(I !== (F.initialValue ?? "")), Q.change(I));
  });
  const ne = S.useRef(null), ie = zp(Z, ne), W = yu();
  return Nt("input", r, {
    ref: [o, ne],
    state: te,
    props: [{
      id: ae,
      disabled: Z,
      name: K,
      ref: Q.inputRef,
      "aria-labelledby": fe,
      autoFocus: g,
      ...oe ? {
        value: p
      } : {
        defaultValue: b
      },
      onChange(pe) {
        const De = pe.currentTarget.value, E = pn(wr, pe.nativeEvent);
        y?.(De, E), !oe && (M(De !== (F.initialValue ?? "")), A(De !== ""), !pe.nativeEvent.defaultPrevented && !E.isCanceled && (L(K), Q.change(De)));
      },
      onFocus() {
        ie(!0);
      },
      onBlur(pe) {
        if (R(!0), ie(!1), N === "onBlur") {
          const De = pe.currentTarget.value;
          Q.commit(De), oe && queueMicrotask(() => {
            const E = Q.inputRef.current?.value;
            E !== void 0 && E !== De && E !== (F.initialValue ?? "") && Q.commit(E);
          });
        }
      },
      onKeyDown(pe) {
        if (pe.currentTarget.tagName === "INPUT" && pe.key === "Enter") {
          R(!0);
          const De = pe.currentTarget.value, E = pe.currentTarget.form;
          if (E && E === V.current && !pe.defaultPrevented) {
            const U = pe.currentTarget, le = P.current;
            W.start(0, () => {
              P.current === le && Q.commit(U.value);
            });
          } else
            Q.commit(De);
        }
      }
    }, q, (pe) => Q.getValidationProps(Z, pe)],
    stateAttributesMapping: c0
  });
}), DC = /* @__PURE__ */ S.forwardRef(function(r, o) {
  return /* @__PURE__ */ O.jsx(MC, {
    ref: o,
    ...r
  });
});
function _C({ className: a, type: r, ...o }) {
  return /* @__PURE__ */ O.jsx(
    DC,
    {
      type: r,
      "data-slot": "input",
      className: Je(
        "va:h-8 va:w-full va:min-w-0 va:rounded-lg va:border va:border-input va:bg-transparent va:px-2.5 va:py-1 va:text-base va:transition-colors va:outline-none va:file:inline-flex va:file:h-6 va:file:border-0 va:file:bg-transparent va:file:text-sm va:file:font-medium va:file:text-foreground va:placeholder:text-muted-foreground va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:pointer-events-none va:disabled:cursor-not-allowed va:disabled:bg-input/50 va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:md:text-sm va:dark:bg-input/30 va:dark:disabled:bg-input/80 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40",
        a
      ),
      ...o
    }
  );
}
const wC = "data-checked", jC = "data-unchecked", qd = {
  checked(a) {
    return a ? {
      [wC]: ""
    } : {
      [jC]: ""
    };
  },
  ...jr,
  ...c0
}, Hc = "data-composite-item-active";
function Dp(a = {}) {
  const {
    highlightItemOnHover: r,
    highlightedIndex: o,
    onHighlightedIndexChange: c
  } = Wd(), {
    ref: f,
    index: d
  } = kd(a), m = o === d, p = S.useRef(null), h = Jl(f, p);
  return {
    compositeProps: {
      tabIndex: m ? 0 : -1,
      onFocus() {
        c(d);
      },
      onMouseMove() {
        const b = p.current;
        if (!r || !b)
          return;
        const g = b.hasAttribute("disabled") || b.ariaDisabled === "true";
        !m && !g && b.focus();
      }
    },
    compositeRef: h,
    index: d
  };
}
function UC(a) {
  const {
    render: r,
    className: o,
    style: c,
    state: f = Yt,
    props: d = Ba,
    refs: m = Ba,
    metadata: p,
    stateAttributesMapping: h,
    tag: y = "div",
    ...b
  } = a, {
    compositeProps: g,
    compositeRef: x
  } = Dp({
    metadata: p
  });
  return Nt(y, a, {
    state: f,
    // The composite ref attaches first so an outer item wins when nested items share a DOM node.
    ref: [x, ...m],
    props: [g, ...d, b],
    stateAttributesMapping: h
  });
}
const _p = /* @__PURE__ */ S.createContext(void 0);
function HC() {
  return S.useContext(_p);
}
function BC(a) {
  if (a == null)
    return "";
  if (typeof a == "string")
    return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}
const wp = /* @__PURE__ */ S.createContext(void 0);
function LC() {
  const a = S.useContext(wp);
  if (a === void 0)
    throw new Error(Wn(52));
  return a;
}
const VC = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    disabled: d = !1,
    readOnly: m = !1,
    required: p = !1,
    "aria-labelledby": h,
    value: y,
    inputRef: b,
    nativeButton: g = !1,
    id: x,
    style: q,
    ...j
  } = r, Y = HC(), {
    disabled: _,
    readOnly: R,
    required: M,
    form: F,
    checkedValue: A,
    touched: N = !1,
    validation: Q,
    name: L,
    setCheckedValue: V = Rt,
    setTouched: P = Rt,
    registerInputRef: Z = Rt
  } = Y ?? {}, {
    setTouched: K,
    setFilled: te,
    state: fe,
    disabled: ae
  } = Hr(), oe = zC(), {
    labelId: I,
    getDescriptionProps: ce
  } = Uc(), ne = ae || oe.disabled || _ || d, ie = R || m, W = M || p, ze = F, pe = Y ? A === y : y === "", De = S.useRef(null), E = zp(ne, De), U = S.useRef(null), le = Q?.registerInput, re = S.useCallback((qe) => le?.(qe, {
    controlRef: De,
    value: void 0
  }), [le]), me = Jl(b, U, Z, re);
  Oe(() => {
    U.current?.checked && te(!0);
  }, [te]), Oe(() => {
    if (U.current) {
      if (ne && pe) {
        Z(null);
        return;
      }
      Z(U.current);
    }
  }, [pe, ne, Z]);
  const ue = Pn(), ye = Np({
    id: x
  }), se = g ? void 0 : ye, ve = CC(h, I, U, !g, se, j["aria-label"]), tt = {
    role: "radio",
    "aria-checked": pe,
    "aria-labelledby": ve,
    [Hc]: pe ? "" : void 0,
    id: g ? ye : ue,
    onKeyDown(qe) {
      qe.key === "Enter" && qe.preventDefault();
    },
    onClick(qe) {
      if (qe.defaultPrevented || ne || ie)
        return;
      qe.preventDefault();
      const ft = U.current;
      ft && mc(ft, qe);
    },
    onFocus(qe) {
      E(!0), !(qe.defaultPrevented || ne || ie || !N) && (U.current?.click(), P(!1));
    },
    onBlur() {
      Y || E(!1);
    }
  }, {
    getButtonProps: je,
    buttonRef: Xe
  } = Ti({
    disabled: ne,
    native: g,
    composite: !1
  }), be = {
    type: "radio",
    ref: me,
    form: ze,
    id: se,
    name: L,
    tabIndex: -1,
    style: L ? bT : $2,
    "aria-hidden": !0,
    ...y !== void 0 ? {
      value: BC(y)
    } : Yt,
    disabled: ne,
    checked: pe,
    required: W,
    readOnly: ie,
    onChange(qe) {
      if (qe.nativeEvent.defaultPrevented || ne || ie || y === void 0)
        return;
      const ft = pn(wr, qe.nativeEvent);
      V(y, ft), !ft.isCanceled && K(!0);
    },
    onClick(qe) {
      qe.stopPropagation();
    },
    onFocus() {
      De.current?.focus();
    }
  }, _e = S.useMemo(() => ({
    ...fe,
    required: W,
    disabled: ne,
    readOnly: ie,
    checked: pe
  }), [fe, ne, ie, pe, W]), Be = _e, Te = Y !== void 0, Ie = [o, De, Xe], Re = [tt, j, je, ce, Q ? (qe) => Q.getValidationProps(ne, qe) : Yt], at = Nt("span", r, {
    enabled: !Te,
    state: _e,
    ref: Ie,
    props: Re,
    stateAttributesMapping: qd
  });
  return /* @__PURE__ */ O.jsxs(wp.Provider, {
    value: Be,
    children: [Te ? /* @__PURE__ */ O.jsx(UC, {
      tag: "span",
      render: c,
      className: f,
      style: q,
      state: _e,
      refs: Ie,
      props: Re,
      stateAttributesMapping: qd
    }) : at, /* @__PURE__ */ O.jsx("input", {
      ...be,
      suppressHydrationWarning: !0
    })]
  });
}), qC = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    style: d,
    keepMounted: m = !1,
    ...p
  } = r, h = LC(), y = h.checked, {
    mounted: b,
    transitionStatus: g,
    setMounted: x
  } = Ac(y), q = {
    ...h,
    transitionStatus: g
  }, j = S.useRef(null), Y = m || b, _ = Nt("span", r, {
    ref: [o, j],
    state: q,
    props: p,
    stateAttributesMapping: qd
  });
  return Ur({
    batch: !0,
    enabled: !y,
    open: y,
    ref: j,
    onComplete() {
      y || x(!1);
    }
  }), Y ? _ : null;
});
function YC(a) {
  return a == null || a.hasAttribute("disabled") || a.getAttribute("aria-disabled") === "true";
}
function GC(a) {
  const {
    loopFocus: r = !0,
    orientation: o = "both",
    grid: c,
    onLoop: f,
    direction: d,
    highlightedIndex: m,
    onHighlightedIndexChange: p,
    rootRef: h,
    enableHomeAndEndKeys: y = !1,
    stopEventPropagation: b,
    disabledIndices: g,
    modifierKeys: x = Ba
  } = a, [q, j] = S.useState(0), Y = c != null, _ = S.useRef(null), R = Jl(_, h), M = S.useRef([]), F = S.useRef(!1), A = S.useRef(null), N = m ?? q, Q = Ae((K, te = !1) => {
    if (A.current = M.current[K] ?? null, (p ?? j)(K), te) {
      const fe = M.current[K];
      Ph(_.current, fe, d, o);
    }
  }), L = Ae((K) => {
    if (K.size === 0)
      return;
    if (F.current) {
      const oe = M.current, I = oe.indexOf(A.current);
      if (I === -1) {
        const ce = oe[N];
        !ce || Rr(oe, N, g) ? Q(XC(oe, g)) : A.current = ce;
      } else I !== N && Q(I);
      return;
    }
    F.current = !0;
    const te = Array.from(K.keys()), fe = te.find((oe) => oe?.hasAttribute(Hc)) ?? null, ae = fe ? K.get(fe)?.index ?? -1 : -1;
    if (ae !== -1)
      Q(ae);
    else if (Rr(te, N, g)) {
      const oe = Cr(te, {
        disabledIndices: g
      });
      md(te, oe) || Q(oe);
    }
    Ph(_.current, fe, d, o);
  });
  Oe(() => {
    if (g == null || m != null || !F.current)
      return;
    const K = M.current;
    if (Rr(K, N, g)) {
      const te = Cr(K, {
        disabledIndices: g
      });
      md(K, te) || Q(te);
    }
  }, [g, m, N, M, Q]);
  const V = Ae((K, te, fe) => f ? f(K, te, fe, M) : fe), P = Ae((K) => {
    const te = K.key === Ld || K.key === Vd;
    if (!Ep.has(K.key) || !y && te || QC(K, x) || !_.current)
      return;
    const ae = d === "rtl", oe = ae ? Hd : Bd, I = ae ? Bd : Hd, ce = o === "vertical" ? Ud : oe, ne = o === "vertical" ? jd : I, ie = dl(K.nativeEvent);
    if (ie != null && Fh(ie) && !YC(ie)) {
      const U = ie.selectionStart, le = ie.selectionEnd, re = ie.value;
      if (U == null || K.shiftKey || U !== le || K.key !== ne && U < re.length || K.key !== ce && U > 0)
        return;
    }
    let W = N;
    const ze = ST(M, g), pe = ET(M, g);
    c != null && (W = c({
      disabledIndices: g,
      elementsRef: M,
      event: K,
      highlightedIndex: N,
      loopFocus: r,
      maxIndex: pe,
      minIndex: ze,
      onLoop: V,
      orientation: o,
      rtl: ae
    }));
    const De = o !== "vertical" && K.key === oe || o !== "horizontal" && K.key === Ud, E = o !== "vertical" && K.key === I || o !== "horizontal" && K.key === jd;
    y && (K.key === Ld ? W = ze : K.key === Vd && (W = pe)), W === N && (De || E) && (r && W === pe && De ? (W = ze, f && (W = f(K, N, W, M))) : r && W === ze && E ? (W = pe, f && (W = f(K, N, W, M))) : W = Cr(M.current, {
      startingIndex: W,
      decrement: E,
      disabledIndices: g
    })), W !== N && !md(M.current, W) && (b && K.stopPropagation(), (Y || te || De || E) && K.preventDefault(), Q(W, !0), queueMicrotask(() => {
      M.current[W]?.focus();
    }));
  });
  return {
    props: {
      ref: R,
      onFocus(K) {
        const te = _.current, fe = dl(K.nativeEvent);
        !te || fe == null || !Fh(fe) || fe.setSelectionRange(0, fe.value.length);
      },
      onKeyDown: P
    },
    highlightedIndex: N,
    onHighlightedIndexChange: Q,
    elementsRef: M,
    onMapChange: L,
    relayKeyboardEvent: P
  };
}
function XC(a, r) {
  let o = -1;
  for (let c = 0; c < a.length; c += 1) {
    const f = a[c];
    if (!(!f || Rr(a, c, r))) {
      if (f.hasAttribute(Hc))
        return c;
      o === -1 && (o = c);
    }
  }
  return Math.max(o, 0);
}
function QC(a, r) {
  for (const o of Ax)
    if (!r.includes(o) && a.getModifierState(o))
      return !0;
  return !1;
}
const KC = /* @__PURE__ */ S.createContext(void 0);
function IC() {
  return S.useContext(KC)?.direction ?? "ltr";
}
function jp(a) {
  const {
    render: r,
    className: o,
    style: c,
    refs: f = Ba,
    props: d = Ba,
    state: m = Yt,
    stateAttributesMapping: p,
    highlightedIndex: h,
    onHighlightedIndexChange: y,
    orientation: b,
    grid: g,
    loopFocus: x,
    onLoop: q,
    enableHomeAndEndKeys: j,
    onMapChange: Y,
    stopEventPropagation: _ = !0,
    rootRef: R,
    disabledIndices: M,
    modifierKeys: F,
    highlightItemOnHover: A = !1,
    tag: N = "div",
    ...Q
  } = a, L = IC(), {
    props: V,
    highlightedIndex: P,
    onHighlightedIndexChange: Z,
    elementsRef: K,
    onMapChange: te,
    relayKeyboardEvent: fe
  } = GC({
    grid: g,
    loopFocus: x,
    onLoop: q,
    orientation: b,
    highlightedIndex: h,
    onHighlightedIndexChange: y,
    rootRef: R,
    stopEventPropagation: _,
    enableHomeAndEndKeys: j,
    direction: L,
    disabledIndices: M,
    modifierKeys: F
  }), ae = Nt(N, a, {
    state: m,
    ref: f,
    props: [V, ...d, Q],
    stateAttributesMapping: p
  }), oe = S.useMemo(() => ({
    highlightedIndex: P,
    onHighlightedIndexChange: Z,
    highlightItemOnHover: A,
    relayKeyboardEvent: fe
  }), [P, Z, A, fe]);
  return /* @__PURE__ */ O.jsx(K2.Provider, {
    value: oe,
    children: /* @__PURE__ */ O.jsx(Xd, {
      elementsRef: K,
      onMapChange: (I) => {
        Y?.(I), te(I);
      },
      children: ae
    })
  });
}
const ZC = [Tp], kC = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    render: c,
    className: f,
    disabled: d,
    readOnly: m,
    required: p,
    onValueChange: h,
    value: y,
    defaultValue: b,
    form: g,
    name: x,
    inputRef: q,
    id: j,
    style: Y,
    ..._
  } = r, {
    setTouched: R,
    setFocused: M,
    validationMode: F,
    name: A,
    disabled: N,
    state: Q,
    validation: L,
    setDirty: V,
    setFilled: P,
    validityData: Z
  } = Hr(), {
    labelId: K
  } = Uc(), {
    clearErrors: te,
    elementRef: fe
  } = Op(), ae = EC(!0), oe = N || d, I = A ?? x, ce = Pn(j), [ne, ie] = Cc({
    controlled: y,
    default: b,
    name: "RadioGroup",
    state: "value"
  }), [W, ze] = S.useState(!1), pe = Ae((be, _e) => {
    h?.(be, _e), !_e.isCanceled && ie(be);
  }), De = L.getInputControl, E = S.useMemo(() => ({
    get current() {
      return De();
    }
  }), [De]), U = S.useRef(null), le = S.useRef(null), re = Jl(U, q), me = S.useRef(re), ue = Ae((be) => {
    U.current === be && me.current === re || (me.current = re, re?.(be));
  });
  Oe(() => {
    ue(U.current);
  }, [re, ue]);
  const ye = Ae((be) => {
    if (be) {
      if (!be.disabled) {
        le.current || (le.current = be);
        const _e = U.current;
        (be.checked || _e == null || _e.disabled) && ue(be);
      }
      return () => {
        le.current === be && (le.current = null), U.current === be && ue(null);
      };
    }
  }), se = Ae(() => {
    const be = fe.current;
    if (!be)
      return ne ?? null;
    for (const _e of L.registeredInputs.keys())
      if (_e.checked && OC(_e, be))
        return ne ?? null;
    return null;
  });
  Mp(E, ce, ne ?? null, se, !oe, x), Cp(ne, () => {
    te(I), V(ne !== Z.initialValue), P(ne != null), L.change(ne);
    const be = le.current;
    ne == null && be && !be.disabled && ue(be);
  });
  const ve = K ?? ae?.legendId, tt = {
    ...Q,
    disabled: oe ?? !1,
    required: p ?? !1,
    readOnly: m ?? !1
  }, je = S.useMemo(() => ({
    checkedValue: ne,
    disabled: oe,
    form: g,
    validation: L,
    name: I,
    readOnly: m,
    registerInputRef: ye,
    required: p,
    setCheckedValue: pe,
    setTouched: ze,
    touched: W
  }), [ne, oe, g, L, I, m, ye, p, pe, ze, W]), Xe = {
    id: j,
    role: "radiogroup",
    "aria-required": p || void 0,
    "aria-disabled": oe || void 0,
    "aria-readonly": m || void 0,
    "aria-labelledby": ve,
    onBlur(be) {
      rt(be.currentTarget, be.relatedTarget) || (ze(!1), R(!0), M(!1), F === "onBlur" && L.commit(ne));
    },
    onKeyDownCapture(be) {
      be.key.startsWith("Arrow") && ze(!0);
    }
  };
  return /* @__PURE__ */ O.jsx(_p.Provider, {
    value: je,
    children: /* @__PURE__ */ O.jsx(jp, {
      render: c,
      className: f,
      style: Y,
      state: tt,
      props: [Xe, _, (be) => L.getValidationProps(oe ?? !1, be)],
      refs: [o],
      stateAttributesMapping: c0,
      enableHomeAndEndKeys: !1,
      modifierKeys: ZC
    })
  });
});
function JC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    kC,
    {
      "data-slot": "radio-group",
      className: Je("va:grid va:w-full va:gap-2", a),
      ...r
    }
  );
}
function FC({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    VC,
    {
      "data-slot": "radio-group-item",
      className: Je(
        "va:group/radio-group-item va:peer va:relative va:flex va:aspect-square va:size-4 va:shrink-0 va:rounded-full va:border va:border-input va:outline-none va:group-has-[:focus-visible]/field-label:ring-0 va:group-has-[:focus-visible]/field-label:not-data-checked:border-input va:after:absolute va:after:-inset-x-3 va:after:-inset-y-2 va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:cursor-not-allowed va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:aria-invalid:aria-checked:border-primary va:dark:bg-input/30 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40 va:data-checked:border-primary va:data-checked:bg-primary va:data-checked:text-primary-foreground va:group-has-[:focus-visible]/field-label:data-checked:border-primary va:dark:data-checked:bg-primary",
        a
      ),
      ...r,
      children: /* @__PURE__ */ O.jsx(
        qC,
        {
          "data-slot": "radio-group-indicator",
          className: "va:flex va:size-4 va:items-center va:justify-center",
          children: /* @__PURE__ */ O.jsx("span", { className: "va:absolute va:top-1/2 va:left-1/2 va:size-2 va:-translate-x-1/2 va:-translate-y-1/2 va:rounded-full va:bg-primary-foreground" })
        }
      )
    }
  );
}
const Up = /* @__PURE__ */ S.createContext(void 0);
function s0() {
  const a = S.useContext(Up);
  if (a === void 0)
    throw new Error(Wn(64));
  return a;
}
const PC = "data-activation-direction", Bc = {
  tabActivationDirection: (a) => ({
    [PC]: a
  })
}, WC = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    className: c,
    defaultValue: f = 0,
    onValueChange: d,
    orientation: m = "horizontal",
    render: p,
    value: h,
    style: y,
    ...b
  } = r, g = r.defaultValue !== void 0, x = S.useRef([]), [q, j] = S.useState(() => /* @__PURE__ */ new Map()), [Y, _] = Cc({
    controlled: h,
    default: f,
    name: "Tabs",
    state: "value"
  }), R = h !== void 0, [M, F] = S.useState(() => /* @__PURE__ */ new Map()), A = S.useRef(void 0), N = S.useCallback((me) => Yd(M, me), [M]), [Q, L] = S.useState(() => ({
    previousValue: Y,
    tabActivationDirection: "none"
  })), {
    previousValue: V,
    tabActivationDirection: P
  } = Q;
  let Z = P, K = !1;
  V !== Y && (Z = r2(V, Y, m, M), K = V != null && Y != null && N(Y) == null);
  const te = K ? V : Y, fe = V !== te || P !== Z;
  Oe(() => {
    fe && L({
      previousValue: te,
      tabActivationDirection: Z
    });
  }, [te, fe, Z]);
  const ae = Ae((me, ue) => {
    const ye = r2(Y, me, m, M);
    ue.activationDirection = ye, d?.(me, ue), !ue.isCanceled && _(() => me);
  }), oe = Ae((me, ue) => {
    d?.(me, pn(ue, void 0, void 0, {
      activationDirection: "none"
    }));
  }), I = Ae((me, ue) => (j((ye) => {
    const se = new Map(ye);
    return se.set(me, ue), se;
  }), () => {
    j((ye) => {
      if (ye.get(me) !== ue)
        return ye;
      const se = new Map(ye);
      return se.delete(me), se;
    });
  })), ce = S.useCallback((me) => q.get(me), [q]), ne = S.useCallback((me) => {
    for (const ue of M.values())
      if (me === ue.value)
        return ue.id;
  }, [M]), ie = S.useMemo(() => ({
    getTabElementBySelectedValue: N,
    getTabIdByPanelValue: ne,
    getTabPanelIdByValue: ce,
    onValueChange: ae,
    orientation: m,
    registerMountedTabPanel: I,
    setTabMap: F,
    tabActivationDirection: Z,
    value: Y
  }), [N, ne, ce, ae, m, I, F, Z, Y]), W = S.useMemo(() => {
    for (const me of M.values())
      if (me.value === Y)
        return me;
  }, [M, Y]), ze = S.useMemo(() => {
    for (const me of M.values())
      if (!me.disabled)
        return me.value;
  }, [M]), pe = S.useRef(!g), De = S.useRef(f), E = S.useRef(g), U = S.useRef(!1);
  Oe(() => {
    if (R)
      return;
    function me(ve, tt) {
      _(() => ve), L({
        previousValue: ve,
        tabActivationDirection: "none"
      }), oe(ve, tt), pe.current = !1;
    }
    if (M.size === 0) {
      U.current && Y !== null && !A.current?.isConnected && me(null, Ch);
      return;
    }
    U.current = !0, A.current = M.keys().next().value;
    const ue = W?.disabled, ye = W == null && Y !== null;
    if (!ue && Y === De.current && (E.current = !1), E.current && ue && Y === De.current)
      return;
    const se = pe.current;
    if (ue || ye) {
      const ve = ze ?? null;
      if (Y === ve) {
        pe.current = !1;
        return;
      }
      let tt = Ch;
      se ? tt = Rh : ue && (tt = iE), me(ve, tt);
      return;
    }
    se && W != null && (oe(Y, Rh), pe.current = !1);
  }, [ze, R, oe, W, _, M, Y]);
  const re = Nt("div", r, {
    state: {
      orientation: m,
      tabActivationDirection: Z
    },
    ref: o,
    props: b,
    stateAttributesMapping: Bc
  });
  return /* @__PURE__ */ O.jsx(Up.Provider, {
    value: ie,
    children: /* @__PURE__ */ O.jsx(Xd, {
      elementsRef: x,
      children: re
    })
  });
});
function Yd(a, r) {
  for (const [o, c] of a.entries())
    if (r === c.value)
      return o;
  return null;
}
function r2(a, r, o, c) {
  if (a == null || r == null)
    return "none";
  const [f, d, m] = o === "horizontal" ? ["left", "left", "right"] : ["top", "up", "down"], p = Yd(c, a), h = Yd(c, r);
  if (p == null || h == null)
    return p !== h && (typeof a == "number" || typeof a == "string") && typeof a == typeof r ? r > a ? m : d : "none";
  const y = p.getBoundingClientRect()[f], b = h.getBoundingClientRect()[f];
  return b < y ? d : b > y ? m : "none";
}
const Hp = /* @__PURE__ */ S.createContext(void 0);
function $C() {
  const a = S.useContext(Hp);
  if (a === void 0)
    throw new Error(Wn(65));
  return a;
}
const e4 = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    className: c,
    disabled: f = !1,
    render: d,
    value: m,
    id: p,
    nativeButton: h = !0,
    style: y,
    ...b
  } = r, {
    value: g,
    getTabPanelIdByValue: x,
    onValueChange: q,
    orientation: j,
    tabActivationDirection: Y
  } = s0(), {
    activateOnFocus: _,
    registerTabResizeObserverElement: R,
    tabsListElement: M
  } = $C(), {
    highlightedIndex: F,
    onHighlightedIndexChange: A
  } = Wd(), N = Pn(p), Q = S.useMemo(() => ({
    disabled: f,
    id: N,
    value: m
  }), [f, N, m]), {
    compositeProps: L,
    compositeRef: V,
    index: P
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = Dp({
    metadata: Q
  }), Z = m === g, K = S.useRef(!1), te = S.useRef(null), fe = Ae((U) => {
    te.current?.(), te.current = U ? R(U) : null;
  });
  Oe(() => {
    if (K.current) {
      K.current = !1;
      return;
    }
    if (!(Z && P > -1 && F !== P))
      return;
    const U = M;
    if (U != null) {
      const le = Ol(Dt(U));
      if (le && rt(U, le))
        return;
    }
    f || A(P);
  }, [Z, P, F, A, f, M]);
  const {
    getButtonProps: ae,
    buttonRef: oe
  } = Ti({
    disabled: f,
    native: h,
    focusableWhenDisabled: !0
  }), I = x(m), ce = S.useRef(!1), ne = S.useRef(!1);
  function ie(U) {
    q(m, pn(wr, U.nativeEvent, void 0, {
      activationDirection: "none"
    }));
  }
  function W(U) {
    Z || f || ie(U);
  }
  function ze(U) {
    Z || f || _ && (!ce.current || // keyboard or touch focus
    ne.current) && ie(U);
  }
  function pe(U) {
    if (Z || f)
      return;
    ce.current = !0, ne.current = U.button === 0;
    const le = Dt(U.currentTarget);
    function re() {
      ce.current = !1, ne.current = !1, le.removeEventListener("pointerup", re), le.removeEventListener("pointercancel", re);
    }
    le.addEventListener("pointerup", re), le.addEventListener("pointercancel", re);
  }
  return Nt("button", r, {
    state: {
      disabled: f,
      active: Z,
      orientation: j,
      tabActivationDirection: Y
    },
    ref: [o, oe, V, fe],
    props: [L, {
      role: "tab",
      "aria-controls": I,
      "aria-selected": Z,
      id: N,
      onClick: W,
      onFocus: ze,
      onPointerDown: pe,
      [Hc]: Z ? "" : void 0,
      onKeyDownCapture() {
        K.current = !0;
      }
    }, b, ae],
    stateAttributesMapping: Bc
  });
}), t4 = "data-index", n4 = {
  ...Bc,
  ...jr
}, l4 = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    className: c,
    value: f,
    render: d,
    keepMounted: m = !1,
    style: p,
    ...h
  } = r, {
    value: y,
    getTabIdByPanelValue: b,
    orientation: g,
    tabActivationDirection: x,
    registerMountedTabPanel: q
  } = s0(), j = Pn(), {
    ref: Y,
    index: _
  } = kd(), R = f === y, {
    mounted: M,
    transitionStatus: F,
    setMounted: A
  } = Ac(R), N = !M, Q = b(f), L = {
    hidden: N,
    orientation: g,
    tabActivationDirection: x,
    transitionStatus: F
  }, V = S.useRef(null), P = Nt("div", r, {
    state: L,
    ref: [o, Y, V],
    props: [{
      "aria-labelledby": Q,
      hidden: N,
      id: j,
      role: "tabpanel",
      tabIndex: R ? 0 : -1,
      inert: xp(!R),
      // Computed key: a plain literal key fails the DOM-props excess property check.
      [t4]: _
    }, h],
    stateAttributesMapping: n4
  });
  return Ur({
    open: R,
    ref: V,
    onComplete() {
      R || A(!1);
    }
  }), Oe(() => {
    if (!(j == null || N && !m))
      return q(f, j);
  }, [N, m, f, j, q]), m || M ? P : null;
}), a4 = /* @__PURE__ */ S.forwardRef(function(r, o) {
  const {
    activateOnFocus: c = !1,
    className: f,
    loopFocus: d = !0,
    render: m,
    style: p,
    ...h
  } = r, {
    orientation: y,
    setTabMap: b,
    tabActivationDirection: g
  } = s0(), [x, q] = S.useState(0), [j, Y] = S.useState(null), _ = S.useRef(/* @__PURE__ */ new Set()), R = S.useRef(/* @__PURE__ */ new Set()), M = S.useRef(null);
  Oe(() => {
    if (typeof ResizeObserver > "u")
      return;
    const V = new ResizeObserver(() => {
      _.current.forEach((P) => {
        P();
      });
    });
    return M.current = V, j && V.observe(j), R.current.forEach((P) => {
      V.observe(P);
    }), () => {
      V.disconnect(), M.current = null;
    };
  }, [j]);
  const F = Ae((V) => (_.current.add(V), () => {
    _.current.delete(V);
  })), A = Ae((V) => (R.current.add(V), M.current?.observe(V), () => {
    R.current.delete(V), M.current?.unobserve(V);
  })), N = {
    orientation: y,
    tabActivationDirection: g
  }, Q = {
    "aria-orientation": y === "vertical" ? "vertical" : void 0,
    role: "tablist"
  }, L = S.useMemo(() => ({
    activateOnFocus: c,
    registerIndicatorUpdateListener: F,
    registerTabResizeObserverElement: A,
    tabsListElement: j
  }), [c, F, A, j]);
  return /* @__PURE__ */ O.jsx(Hp.Provider, {
    value: L,
    children: /* @__PURE__ */ O.jsx(jp, {
      render: m,
      className: f,
      style: p,
      state: N,
      refs: [o, Y],
      props: [Q, h],
      stateAttributesMapping: Bc,
      highlightedIndex: x,
      enableHomeAndEndKeys: !0,
      loopFocus: d,
      orientation: y,
      onHighlightedIndexChange: q,
      onMapChange: b,
      disabledIndices: Ba
    })
  });
});
function u4({
  className: a,
  orientation: r = "horizontal",
  ...o
}) {
  return /* @__PURE__ */ O.jsx(
    WC,
    {
      "data-slot": "tabs",
      "data-orientation": r,
      orientation: r,
      className: Je(
        "va:group/tabs va:flex va:gap-2 va:data-[orientation=horizontal]:flex-col",
        a
      ),
      ...o
    }
  );
}
const i4 = Mc(
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
function r4({
  className: a,
  variant: r = "default",
  ...o
}) {
  return /* @__PURE__ */ O.jsx(
    a4,
    {
      "data-slot": "tabs-list",
      "data-variant": r,
      className: Je(i4({ variant: r }), a),
      ...o
    }
  );
}
function o4({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    e4,
    {
      "data-slot": "tabs-trigger",
      className: Je(
        "va:relative va:inline-flex va:h-[calc(100%-1px)] va:flex-1 va:items-center va:justify-center va:gap-1.5 va:rounded-md va:border va:border-transparent va:px-1.5 va:py-0.5 va:text-sm va:font-medium va:whitespace-nowrap va:text-foreground/60 va:transition-all va:group-data-[orientation=vertical]/tabs:w-full va:group-data-[orientation=vertical]/tabs:justify-start va:hover:text-foreground va:focus-visible:border-ring va:focus-visible:ring-[3px] va:focus-visible:ring-ring/50 va:focus-visible:outline-1 va:focus-visible:outline-ring va:disabled:pointer-events-none va:disabled:opacity-50 va:has-data-[icon=inline-end]:pr-1 va:has-data-[icon=inline-start]:pl-1 va:aria-disabled:pointer-events-none va:aria-disabled:opacity-50 va:dark:text-muted-foreground va:dark:hover:text-foreground va:group-data-[variant=default]/tabs-list:data-active:shadow-sm va:group-data-[variant=line]/tabs-list:data-active:shadow-none va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
        "va:group-data-[variant=line]/tabs-list:bg-transparent va:group-data-[variant=line]/tabs-list:data-active:bg-transparent va:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent va:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "va:data-active:bg-background va:data-active:text-foreground va:dark:data-active:border-input va:dark:data-active:bg-input/30 va:dark:data-active:text-foreground",
        "va:after:absolute va:after:bg-foreground va:after:opacity-0 va:after:transition-opacity va:group-data-[orientation=horizontal]/tabs:after:inset-x-0 va:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] va:group-data-[orientation=horizontal]/tabs:after:h-0.5 va:group-data-[orientation=vertical]/tabs:after:inset-y-0 va:group-data-[orientation=vertical]/tabs:after:-right-1 va:group-data-[orientation=vertical]/tabs:after:w-0.5 va:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        a
      ),
      ...r
    }
  );
}
function c4({ className: a, ...r }) {
  return /* @__PURE__ */ O.jsx(
    l4,
    {
      "data-slot": "tabs-content",
      className: Je("va:flex-1 va:text-sm va:outline-none", a),
      ...r
    }
  );
}
const Bp = Object.freeze([
  { id: "all", label: "All weapons" },
  { id: "sidearm", label: "Sidearms" },
  { id: "smg", label: "SMGs" },
  { id: "shotgun", label: "Shotguns" },
  { id: "rifle", label: "Rifles" },
  { id: "sniper", label: "Sniper rifles" },
  { id: "heavy", label: "Machine guns" },
  { id: "special", label: "Special" }
]), s4 = Object.freeze([
  { id: "all", label: "All weapons" },
  { id: "blades", label: "Blades" },
  { id: "impact", label: "Impact" }
]), o2 = Object.freeze({
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
}), Lp = (a) => a === "melee" ? s4 : Bp, Vp = (a) => a === "melee" ? S1 : p1, Ei = (a) => `${a.toFixed(2)} s`, f4 = (a) => String(Number(a.toFixed(2))), Nl = (a, r, o = "") => ({ label: a, value: String(r), note: o });
function d4(a, r = "gun") {
  const o = Vp(r), c = typeof a == "string" ? Object.hasOwn(o, a) ? o[a] : null : a, f = c?.id ?? (typeof a == "string" ? a : "");
  return r === "melee" ? ["axe", "tonfas"].includes(f) ? "impact" : "blades" : Bp.some((d) => d.id !== "all" && d.id === c?.category) ? c.category : Object.hasOwn(o2, f) ? o2[f] : "special";
}
function v4(a) {
  const r = m1(a);
  if (!r) return [];
  const o = r.pellets > 1, c = o ? `Body damage per pellet · ${r.pellets} pellets per shell · close range` : "Body hit · close range", f = o ? "shells" : a.projectile ? "bolts" : "rounds", d = a.projectile ? "Includes reload between bolts" : r.windupSeconds ? `${Ei(r.windupSeconds)} wind-up` : r.mode === "burst" ? "Includes burst recovery" : "", m = Number.isFinite(r.emptyReloadSeconds) && r.emptyReloadSeconds !== r.reloadSeconds ? `${Ei(r.emptyReloadSeconds)} when empty` : "";
  return [
    Nl("Damage", h1(a, "body", 0), c),
    Nl("Magazine", a.magazine, `${f} · ${a.reserve} in reserve`),
    Nl("Fire rate", r.fireRateLabel, d),
    Nl("Reload", Ei(r.reloadSeconds), m)
  ];
}
function g4(a) {
  const r = y1(a.id), o = b1({ meleeWeapon: a.id, meleeAction: "primary", meleeComboWeapon: a.id, meleeComboStep: r });
  return [
    Nl("Damage", a.damage, "Opening strike"),
    Nl("Reach", `${f4(a.reach)} m`, "Primary strike"),
    Nl("Wind-up", Ei(a.startupTicks / 120), "Before the strike becomes active"),
    Nl("Swing", Ei((a.startupTicks + a.activeTicks + a.recoveryTicks) / 120), "Full swing and recovery"),
    Nl("Combo", `${r} hits`, `Confirm each hit · ${Ei(E1 / 120)} after recovery to follow up`),
    Nl("Finisher", o.damage, "Last confirmed cut · stronger push and brief stagger; enemies can resist")
  ];
}
function m4(a, r = "gun") {
  const o = Vp(r), c = /* @__PURE__ */ new Set();
  return Array.from(a?.options ?? []).flatMap((f) => {
    const d = String(f.value ?? "");
    if (!d || c.has(d)) return [];
    c.add(d);
    const m = Object.hasOwn(o, d) ? o[d] : null, p = m?.name || String(f.label || f.textContent || f.text || d).trim() || d, h = d4(m ?? d, r), y = f.closest?.("optgroup") ?? (f.parentElement?.tagName === "OPTGROUP" ? f.parentElement : null);
    return [{
      id: d,
      name: p,
      label: m?.label || p,
      category: h,
      categoryLabel: Lp(r).find((b) => b.id === h)?.label || "Special",
      description: m?.description || "",
      image: `art/armory/${r === "melee" ? "melee_" : ""}${encodeURIComponent(d)}.webp`,
      disabled: !!(a.disabled || f.disabled || y?.disabled),
      weapon: m,
      stats: m ? r === "melee" ? g4(m) : v4(m) : []
    }];
  });
}
function h4(a, r = "gun") {
  return Lp(r).flatMap((o) => {
    const c = o.id === "all" ? a.length : a.filter((f) => f.category === o.id).length;
    return o.id === "all" || c ? [{ ...o, count: c }] : [];
  });
}
function p4(a, r = "all", o = "") {
  const c = String(o ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return a.filter((f) => {
    if (r && r !== "all" && f.category !== r) return !1;
    const d = [f.name, f.label, f.id, f.categoryLabel, f.description].join(" ").toLocaleLowerCase();
    return c.every((m) => d.includes(m));
  });
}
const y4 = (a) => a.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || a;
function f0({ entry: a, hero: r = !1, eager: o = !1 }) {
  const [c, f] = S.useState(!1);
  return S.useEffect(() => f(!1), [a.image]), c ? /* @__PURE__ */ O.jsx("span", { className: "armory-image-fallback", children: a.label }) : /* @__PURE__ */ O.jsx("img", { src: a.image, alt: "", className: Je("armory-weapon-image", r && "armory-weapon-image-hero"), loading: r || o ? "eager" : "lazy", draggable: !1, onError: () => f(!0) });
}
function b4({ entry: a, kind: r }) {
  const o = S.useRef(null), c = S.useRef(null), f = S.useRef(a.id), [d, m] = S.useState(!1), [p, h] = S.useState(!1);
  return f.current = a.id, S.useEffect(() => {
    let y = !1;
    return m(!1), h(!1), import("./voxel-armory-preview.js").then(async ({ createWeaponPreview: b }) => {
      if (y || !o.current) return;
      const g = await b(o.current, {
        weaponId: f.current,
        kind: r,
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
        onError: () => {
          y || (m(!1), h(!0));
        }
      });
      if (y) {
        g.destroy();
        return;
      }
      c.current = g, g.setWeapon(f.current, r), m(!0);
    }).catch(() => {
      y || h(!0);
    }), () => {
      y = !0, c.current?.destroy(), c.current = null;
    };
  }, [r]), S.useEffect(() => {
    c.current?.setWeapon(a.id, r);
  }, [a.id, r]), /* @__PURE__ */ O.jsxs("div", { className: "armory-inspection", children: [
    /* @__PURE__ */ O.jsxs("div", { className: "armory-hero-stage", "data-preview-ready": d, children: [
      /* @__PURE__ */ O.jsx("div", { className: "armory-hero-grid", "aria-hidden": "true" }),
      /* @__PURE__ */ O.jsx("div", { className: "armory-hero-caption", "aria-hidden": "true", children: r === "melee" ? "CLOSE QUARTERS" : "WEAPON INSPECTION" }),
      !d && /* @__PURE__ */ O.jsx(f0, { entry: a, hero: !0 }),
      /* @__PURE__ */ O.jsx("canvas", { ref: o, "data-armory-preview": !0, tabIndex: d ? 0 : -1, "aria-hidden": !d, "aria-label": `Inspect ${a.name}. Drag or use arrow keys to rotate. Home resets.` }),
      /* @__PURE__ */ O.jsx(bi, { variant: "outline", className: "armory-preview-badge", children: d ? "3D model" : p ? "Weapon model" : "Loading 3D" })
    ] }),
    /* @__PURE__ */ O.jsxs("div", { className: "armory-inspection-tools", children: [
      /* @__PURE__ */ O.jsx("span", { children: d ? "Drag to rotate · arrow keys when focused" : "Actual in-game weapon model" }),
      d && /* @__PURE__ */ O.jsxs(ja, { variant: "ghost", size: "sm", "aria-label": "Reset weapon preview", "data-armory-action": "reset-preview", onClick: () => c.current?.reset(), children: [
        /* @__PURE__ */ O.jsx(CS, { "data-icon": "inline-start" }),
        "Reset"
      ] })
    ] })
  ] });
}
function c2({ entry: a }) {
  return a.stats.length ? /* @__PURE__ */ O.jsx("dl", { className: "armory-stats", children: a.stats.map((r) => /* @__PURE__ */ O.jsxs("div", { className: "armory-stat", children: [
    /* @__PURE__ */ O.jsx("dt", { children: r.label }),
    /* @__PURE__ */ O.jsx("dd", { children: r.value }),
    r.note && /* @__PURE__ */ O.jsx("span", { children: r.note })
  ] }, r.label)) }) : null;
}
function S4({ entry: a, kind: r, disabled: o, triggerRef: c }) {
  return /* @__PURE__ */ O.jsxs($d, { variant: "loadout", size: "sm", children: [
    /* @__PURE__ */ O.jsxs(e0, { children: [
      /* @__PURE__ */ O.jsx(bc, { children: a?.categoryLabel || (r === "melee" ? "Melee weapon" : "Starting gun") }),
      /* @__PURE__ */ O.jsx(t0, { children: a?.name || "Choose your weapon" })
    ] }),
    /* @__PURE__ */ O.jsx(n0, { children: /* @__PURE__ */ O.jsx("div", { className: "armory-loadout-art", children: a && /* @__PURE__ */ O.jsx(f0, { entry: a }) }) }),
    /* @__PURE__ */ O.jsxs(l0, { children: [
      /* @__PURE__ */ O.jsx("span", { className: "armory-loadout-facts", children: a?.stats.length ? r === "melee" ? `${a.stats[0].value} damage · ${a.stats[1].value} reach` : `${a.stats[1].value} ${a.weapon?.projectile ? "bolt" : a.weapon?.pellets ? "shells" : "rounds"} · ${a.stats[3].value} reload` : "Explore the armory" }),
      /* @__PURE__ */ O.jsxs($x, { ref: c, render: /* @__PURE__ */ O.jsx(ja, { variant: "outline", size: "sm", "data-armory-action": "open", disabled: o }), "aria-label": `Open ${r === "melee" ? "melee " : ""}armory${a ? `, equipped ${a.name}` : ""}`, children: [
        "Armory",
        /* @__PURE__ */ O.jsx(xS, { "data-icon": "inline-end" })
      ] })
    ] })
  ] });
}
function E4({ entry: a, selected: r, equipped: o, choiceId: c }) {
  const f = a.stats[0];
  return /* @__PURE__ */ O.jsx(Rp, { "data-disabled": a.disabled || void 0, className: "armory-choice", children: /* @__PURE__ */ O.jsx(Ap, { htmlFor: c, className: "armory-choice-label", children: /* @__PURE__ */ O.jsxs($d, { variant: "weapon", size: "sm", className: "armory-tile", "data-selected": r, "data-equipped": o, "data-entry-id": a.id, children: [
    /* @__PURE__ */ O.jsxs(e0, { children: [
      /* @__PURE__ */ O.jsx(bc, { children: a.label === a.name.toUpperCase() ? a.categoryLabel : a.label.toLowerCase() }),
      /* @__PURE__ */ O.jsx(t0, { children: a.name })
    ] }),
    /* @__PURE__ */ O.jsx(n0, { children: /* @__PURE__ */ O.jsx("div", { className: "armory-thumbnail-stage", children: /* @__PURE__ */ O.jsx(f0, { entry: a, eager: !0 }) }) }),
    /* @__PURE__ */ O.jsxs(l0, { children: [
      /* @__PURE__ */ O.jsx("span", { children: o ? /* @__PURE__ */ O.jsxs(bi, { variant: "secondary", children: [
        /* @__PURE__ */ O.jsx(SS, { "data-icon": "inline-start" }),
        "Equipped"
      ] }) : f ? `${f.value} ${a.weapon?.pellets ? "per pellet" : "damage"}` : a.categoryLabel }),
      /* @__PURE__ */ O.jsx(FC, { id: c, value: a.id, disabled: a.disabled, "aria-label": `Preview ${a.name}`, "data-weapon-id": a.id })
    ] })
  ] }) }) });
}
function T4({ snapshot: a, kind: r, title: o, portalContainer: c, onCommit: f, commandRef: d }) {
  const m = S.useId(), p = S.useRef(null), [h, y] = S.useState(!1), [b, g] = S.useState(a.value), [x, q] = S.useState("all"), [j, Y] = S.useState(""), _ = a.entries.find((N) => N.id === a.value), R = a.entries.find((N) => N.id === b), M = h4(a.entries, r), F = p4(a.entries, x, j);
  S.useImperativeHandle(d, () => ({ close: () => y(!1), isOpen: () => h, focus: () => p.current?.focus() }), [h]), S.useEffect(() => {
    h || g(a.value), a.disabled && y(!1);
  }, [a.value, a.disabled, h]), S.useEffect(() => {
    M.some((N) => N.id === x) || q("all"), b && !a.entries.some((N) => N.id === b) && g(a.value);
  }, [a.entries, x, b, a.value]);
  const A = (N) => {
    N && a.disabled || (N && (g(a.value), q("all"), Y("")), y(N));
  };
  return /* @__PURE__ */ O.jsxs(Wx, { open: h, onOpenChange: A, children: [
    /* @__PURE__ */ O.jsx(S4, { triggerRef: p, entry: _, kind: r, disabled: a.disabled || !a.entries.some((N) => !N.disabled) }),
    /* @__PURE__ */ O.jsxs(nC, { variant: "armory", portalContainer: c, "data-voxel-armory": "", onKeyDown: (N) => {
      N.stopPropagation(), N.key === "Escape" && (N.preventDefault(), A(!1));
    }, onKeyUp: (N) => N.stopPropagation(), "data-kind": r, "data-draft-weapon": b, showCloseButton: !1, initialFocus: () => document.getElementById(`${m}-search`), children: [
      /* @__PURE__ */ O.jsx(lC, { className: "armory-dialog-header", children: /* @__PURE__ */ O.jsxs("div", { className: "armory-dialog-heading", children: [
        /* @__PURE__ */ O.jsxs("div", { className: "armory-heading-copy", children: [
          /* @__PURE__ */ O.jsxs("div", { className: "armory-eyebrow", children: [
            /* @__PURE__ */ O.jsx(AS, { "aria-hidden": "true" }),
            "THE ARMORY",
            /* @__PURE__ */ O.jsxs(bi, { variant: "outline", children: [
              a.entries.length,
              " ",
              r === "melee" ? "melee weapons" : "weapons"
            ] })
          ] }),
          /* @__PURE__ */ O.jsx(uC, { children: o }),
          /* @__PURE__ */ O.jsx(iC, { children: "Find your style. Inspect a weapon, then equip it." })
        ] }),
        /* @__PURE__ */ O.jsx(ja, { variant: "ghost", size: "icon-lg", "data-armory-action": "cancel", "aria-label": "Close armory", onClick: () => A(!1), children: /* @__PURE__ */ O.jsx(R2, {}) })
      ] }) }),
      /* @__PURE__ */ O.jsxs(u4, { value: x, onValueChange: (N) => q(String(N)), className: "armory-tabs", children: [
        /* @__PURE__ */ O.jsxs("div", { className: "armory-browser-toolbar", children: [
          /* @__PURE__ */ O.jsx("div", { className: "armory-category-scroll", children: /* @__PURE__ */ O.jsx(r4, { variant: "armory", "aria-label": "Weapon categories", children: M.map((N) => /* @__PURE__ */ O.jsxs(o4, { value: N.id, "data-category": N.id, children: [
            N.label,
            /* @__PURE__ */ O.jsx("span", { className: "armory-category-count", children: N.count })
          ] }, N.id)) }) }),
          /* @__PURE__ */ O.jsx(fC, { className: "armory-search-group", children: /* @__PURE__ */ O.jsxs(Rp, { children: [
            /* @__PURE__ */ O.jsx(Ap, { htmlFor: `${m}-search`, className: "va:sr-only", children: "Search weapons" }),
            /* @__PURE__ */ O.jsxs("div", { className: "armory-search-box", children: [
              /* @__PURE__ */ O.jsx(RS, { "aria-hidden": "true" }),
              /* @__PURE__ */ O.jsx(_C, { id: `${m}-search`, "data-armory-search": !0, type: "search", placeholder: "Search weapons…", value: j, onChange: (N) => Y(N.target.value), autoComplete: "off" })
            ] })
          ] }) })
        ] }),
        /* @__PURE__ */ O.jsxs("div", { className: "armory-body", children: [
          /* @__PURE__ */ O.jsxs("div", { className: "armory-catalog", children: [
            /* @__PURE__ */ O.jsxs("div", { className: "armory-results-line", children: [
              /* @__PURE__ */ O.jsxs("span", { children: [
                F.length,
                " ",
                F.length === 1 ? "weapon" : "weapons",
                x === "all" ? " in your armory" : ` · ${M.find((N) => N.id === x)?.label}`
              ] }),
              /* @__PURE__ */ O.jsx("span", { children: "Choose to inspect" })
            ] }),
            M.map((N) => /* @__PURE__ */ O.jsx(c4, { value: N.id, hidden: x !== N.id, className: "armory-catalog-panel", children: F.length ? /* @__PURE__ */ O.jsxs(cC, { className: "armory-weapon-fieldset", children: [
              /* @__PURE__ */ O.jsxs(sC, { className: "va:sr-only", children: [
                "Choose a ",
                r === "melee" ? "melee weapon" : "gun",
                " to preview"
              ] }),
              /* @__PURE__ */ O.jsx(JC, { value: b, onValueChange: (Q) => g(String(Q)), className: "armory-weapon-grid", "aria-label": "Weapon preview selection", children: F.map((Q) => /* @__PURE__ */ O.jsx(E4, { entry: Q, selected: b === Q.id, equipped: a.value === Q.id, choiceId: `${m}-${N.id}-${Q.id}` }, Q.id)) })
            ] }) : /* @__PURE__ */ O.jsxs(l2, { className: "armory-empty", children: [
              /* @__PURE__ */ O.jsxs(a2, { children: [
                /* @__PURE__ */ O.jsx(u2, { children: "No weapons found" }),
                /* @__PURE__ */ O.jsx(i2, { children: "Try another name or weapon category." })
              ] }),
              /* @__PURE__ */ O.jsx(rC, { children: /* @__PURE__ */ O.jsx(ja, { variant: "outline", onClick: () => {
                Y(""), q("all");
              }, children: "Clear filters" }) })
            ] }) }, N.id))
          ] }),
          /* @__PURE__ */ O.jsx("aside", { className: "armory-detail", "aria-label": "Selected weapon details", children: R ? /* @__PURE__ */ O.jsxs($d, { variant: "detail", children: [
            /* @__PURE__ */ O.jsxs(e0, { children: [
              /* @__PURE__ */ O.jsxs("div", { className: "armory-detail-badges", children: [
                /* @__PURE__ */ O.jsx(bi, { variant: "outline", children: R.categoryLabel }),
                R.weapon?.valorant && /* @__PURE__ */ O.jsx(bi, { variant: "secondary", children: "VALORANT collection" }),
                a.value === R.id && /* @__PURE__ */ O.jsx(bi, { variant: "secondary", children: "Equipped" })
              ] }),
              /* @__PURE__ */ O.jsx(t0, { children: R.name }),
              /* @__PURE__ */ O.jsx(bc, { children: y4(R.description) || "Inspect the weapon before adding it to your loadout." })
            ] }),
            /* @__PURE__ */ O.jsxs(n0, { children: [
              h && /* @__PURE__ */ O.jsx(b4, { entry: R, kind: r }),
              /* @__PURE__ */ O.jsx("div", { className: "armory-desktop-stats", children: /* @__PURE__ */ O.jsx(c2, { entry: R }) }),
              /* @__PURE__ */ O.jsx(LE, { className: "armory-mobile-details", children: /* @__PURE__ */ O.jsxs(VE, { value: "details", children: [
                /* @__PURE__ */ O.jsxs(qE, { "data-armory-action": "details", children: [
                  /* @__PURE__ */ O.jsx("span", { className: "armory-mobile-only", children: "Weapon details & stats" }),
                  /* @__PURE__ */ O.jsx("span", { className: "armory-desktop-only", children: "Handling notes" })
                ] }),
                /* @__PURE__ */ O.jsxs(YE, { children: [
                  /* @__PURE__ */ O.jsx(bc, { children: R.description || "Inspect the weapon before adding it to your loadout." }),
                  /* @__PURE__ */ O.jsx("div", { className: "armory-mobile-stats", children: /* @__PURE__ */ O.jsx(c2, { entry: R }) })
                ] })
              ] }) }, R.id)
            ] }),
            /* @__PURE__ */ O.jsx(l0, { children: /* @__PURE__ */ O.jsx("span", { children: r === "gun" ? "Damage shown at close range. Range and aim affect each hit." : "Stats describe the primary strike." }) })
          ] }) : /* @__PURE__ */ O.jsx(l2, { children: /* @__PURE__ */ O.jsxs(a2, { children: [
            /* @__PURE__ */ O.jsx(u2, { children: "Choose a weapon" }),
            /* @__PURE__ */ O.jsx(i2, { children: "Select a card to inspect its model and stats." })
          ] }) }) })
        ] })
      ] }),
      /* @__PURE__ */ O.jsxs(aC, { className: "armory-dialog-footer", children: [
        /* @__PURE__ */ O.jsxs("div", { className: "armory-equipped-note", children: [
          /* @__PURE__ */ O.jsx("span", { children: "Current loadout" }),
          /* @__PURE__ */ O.jsx("strong", { children: _?.name || "No weapon selected" })
        ] }),
        /* @__PURE__ */ O.jsxs("div", { className: "armory-footer-actions", children: [
          /* @__PURE__ */ O.jsx(ja, { variant: "outline", "data-armory-action": "cancel", onClick: () => A(!1), children: "Cancel" }),
          /* @__PURE__ */ O.jsxs(ja, { variant: "equip", size: "lg", "data-armory-action": "equip", disabled: !R || R.disabled || a.disabled, onClick: () => {
            R && f(R.id) && A(!1);
          }, children: [
            "Equip ",
            R?.name || "weapon",
            /* @__PURE__ */ O.jsx(bS, { "data-icon": "inline-end" })
          ] })
        ] })
      ] })
    ] })
  ] });
}
const xd = /* @__PURE__ */ new WeakMap();
function R4({ select: a, title: r, kind: o = "gun", portalContainer: c }) {
  if (!a || a.tagName !== "SELECT") throw new TypeError("mountWeaponArmory requires a native select");
  const f = xd.get(a);
  if (f)
    return f.sync(), f;
  const d = a.ownerDocument.createElement("div");
  d.className = "voxel-armory-root", d.dataset.voxelArmory = "", d.dataset.selectId = a.id;
  const m = { hidden: a.hidden, tabIndex: a.getAttribute("tabindex"), ariaHidden: a.getAttribute("aria-hidden") };
  a.insertAdjacentElement("afterend", d);
  const p = w1.createRoot(d), h = s2.createRef();
  let y = !1, b, g, x = !0;
  const q = (R) => {
    const M = Array.from(a.options).find((F) => F.value === R);
    return y || a.disabled || !M || M.disabled || M.parentElement?.tagName === "OPTGROUP" && M.parentElement.disabled ? !1 : (a.value !== R && (a.value = R, a.dispatchEvent(new Event("change", { bubbles: !0 }))), _.sync(), !0);
  }, j = () => {
    if (y || !x && b === a.value && g === a.disabled) return;
    b = a.value, g = a.disabled, x = !1, d.dataset.selectedWeapon = a.value, d.dataset.disabled = String(a.disabled);
    const R = { value: a.value, disabled: a.disabled, entries: m4(a, o) };
    p.render(/* @__PURE__ */ O.jsx(T4, { snapshot: R, kind: o, portalContainer: c, title: r || (o === "melee" ? "Choose your melee weapon" : "Choose your weapon"), onCommit: q, commandRef: h }));
  }, Y = new MutationObserver((R) => {
    R.some((M) => M.target !== a || M.type !== "attributes") && (x = !0), j();
  }), _ = {
    sync: j,
    close: () => h.current?.close(),
    isOpen: () => h.current?.isOpen() || !1,
    focus: () => h.current?.focus(),
    destroy: () => {
      y || (y = !0, Y.disconnect(), a.removeEventListener("change", j), p.unmount(), d.remove(), xd.delete(a), a.hidden = m.hidden, m.tabIndex === null ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", m.tabIndex), m.ariaHidden === null ? a.removeAttribute("aria-hidden") : a.setAttribute("aria-hidden", m.ariaHidden));
    }
  };
  try {
    _r.flushSync(j), a.hidden = !0, a.tabIndex = -1, a.setAttribute("aria-hidden", "true"), a.addEventListener("change", j), Y.observe(a, { childList: !0, subtree: !0, attributes: !0, attributeFilter: ["disabled", "selected", "value", "label"], characterData: !0 }), xd.set(a, _);
  } catch (R) {
    throw _.destroy(), R;
  }
  return _;
}
export {
  R4 as mountWeaponArmory
};
