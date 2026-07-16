/* @ds-bundle: {"format":3,"namespace":"OrkalisDesignSystem_0b70cb","components":[{"name":"Alert","sourcePath":"components/core/Alert.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Checkbox","sourcePath":"components/core/Checkbox.jsx"},{"name":"Dialog","sourcePath":"components/core/Dialog.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"KpiCard","sourcePath":"components/core/KpiCard.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Tooltip","sourcePath":"components/core/Tooltip.jsx"}],"sourceHashes":{"assets/orkicon.js":"02942f782aac","components/core/Alert.jsx":"59018fc1583c","components/core/Avatar.jsx":"13d58459b6f1","components/core/Badge.jsx":"4c6152c05b12","components/core/Button.jsx":"1fc74908526c","components/core/Card.jsx":"b21130376b8d","components/core/Checkbox.jsx":"14c3b5e2ee03","components/core/Dialog.jsx":"51ffb6ea80c9","components/core/IconButton.jsx":"203b52d0aa86","components/core/Input.jsx":"b00640052ecd","components/core/KpiCard.jsx":"d618a9cd6cfa","components/core/Select.jsx":"72858b50a0e6","components/core/Switch.jsx":"d746c2356cbc","components/core/Tabs.jsx":"7af83c5770e7","components/core/Tag.jsx":"60200538677c","components/core/Tooltip.jsx":"d74c6d1fef18","ui_kits/dashboard/App.jsx":"0274799f7dd2","ui_kits/dashboard/Charts.jsx":"495c04f8a6cf","ui_kits/dashboard/Sidebar.jsx":"211d04aec630","ui_kits/dashboard/Topbar.jsx":"537215713c5e","ui_kits/dashboard/Views.jsx":"164a4d57741b","ui_kits/marketing/Features.jsx":"6f37cecb5bc7","ui_kits/marketing/Hero.jsx":"bbd60b26d638","ui_kits/marketing/MktNav.jsx":"98c60999bd63","ui_kits/marketing/Sections.jsx":"2d330507c429","ui_kits/marketing/Site.jsx":"1997aa689529"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.OrkalisDesignSystem_0b70cb = window.OrkalisDesignSystem_0b70cb || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/orkicon.js
try { (() => {
/* OrkIcon — render a Lucide icon as a real React SVG element.
   Requires React (global) and the lucide UMD build loaded first.
   Usage:  <OrkIcon name="trending-up" size={18} />
   Plain JS (no JSX) so it loads via a normal <script src>. */
(function () {
  function pascal(name) {
    return String(name).replace(/(^|-)([a-z0-9])/g, function (_, __, c) {
      return c.toUpperCase();
    });
  }
  function getNode(name) {
    var L = window.lucide || {};
    var key = pascal(name);
    // UMD exposes icons under .icons (preferred) and sometimes top-level.
    if (L.icons && L.icons[key]) return L.icons[key];
    if (L[key] && Array.isArray(L[key])) return L[key];
    return null;
  }
  window.OrkIcon = function OrkIcon(props) {
    props = props || {};
    var size = props.size || 18;
    var stroke = props.stroke || 2;
    var node = getNode(props.name);
    if (!node) {
      // graceful empty box so layout doesn't jump
      return React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24"
      });
    }
    var children = node.map(function (c, i) {
      return React.createElement(c[0], Object.assign({
        key: i
      }, c[1]));
    });
    return React.createElement("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: stroke,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: Object.assign({
        display: "block"
      }, props.style)
    }, children);
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/orkicon.js", error: String((e && e.message) || e) }); }

// components/core/Alert.jsx
try { (() => {
/**
 * Inline message banner. Tones: info / success / warning / error.
 * Soft tinted fill + left status border. Pass a Lucide icon via `icon`.
 */
function Alert({
  children,
  title,
  tone = "info",
  icon = null,
  onClose,
  style = {}
}) {
  const tones = {
    info: {
      fg: "var(--info)",
      bg: "var(--info-tint)"
    },
    success: {
      fg: "var(--success)",
      bg: "var(--success-tint)"
    },
    warning: {
      fg: "#B45309",
      bg: "var(--warning-tint)"
    },
    error: {
      fg: "var(--error)",
      bg: "var(--error-tint)"
    }
  };
  const t = tones[tone] || tones.info;
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    style: {
      display: "flex",
      gap: "var(--space-3)",
      padding: "var(--space-4)",
      background: t.bg,
      borderRadius: "var(--radius-sm)",
      borderLeft: `3px solid ${t.fg}`,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: t.fg,
      width: 18,
      height: 18,
      flex: "none",
      marginTop: 1
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-body)",
      fontWeight: 600,
      fontSize: "var(--text-sm)",
      color: "var(--text-primary)",
      marginBottom: children ? 2 : 0
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      lineHeight: "20px",
      color: "var(--text-secondary)"
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Cerrar",
    onClick: onClose,
    style: {
      display: "inline-flex",
      border: "none",
      background: "transparent",
      color: "var(--text-tertiary)",
      cursor: "pointer",
      padding: 0,
      height: 18
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Alert.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
/**
 * User avatar — image or initials fallback. Optional status ring.
 * Initials background is derived from the name for stable variety.
 */
function Avatar({
  name = "",
  src,
  size = 36,
  status,
  style = {}
}) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  // Deterministic cool-tone background from name
  const palette = ["#1A73E8", "#0F1923", "#475569", "#00A88A", "#3B82F6", "#334155"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = palette[Math.abs(hash) % palette.length];
  const statusColors = {
    online: "var(--success)",
    away: "var(--warning)",
    offline: "var(--gray-400)"
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      flex: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "var(--radius-pill)",
      background: src ? "var(--surface-sunken)" : bg,
      color: "#fff",
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: size * 0.4,
      letterSpacing: "-0.02em",
      overflow: "hidden",
      userSelect: "none"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials || "?"), status && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: Math.max(8, size * 0.28),
      height: Math.max(8, size * 0.28),
      borderRadius: "var(--radius-pill)",
      background: statusColors[status] || "var(--gray-400)",
      border: "2px solid var(--surface-card)"
    }
  }));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
/**
 * Compact status label. Tinted-fill by default (soft), or solid.
 * Tones: neutral / brand / success / warning / error / info / accent.
 */
function Badge({
  children,
  tone = "neutral",
  solid = false,
  dot = false,
  style = {}
}) {
  const tones = {
    neutral: {
      fg: "var(--text-secondary)",
      bg: "var(--surface-sunken)",
      solidBg: "var(--gray-600)"
    },
    brand: {
      fg: "var(--brand)",
      bg: "var(--brand-tint)",
      solidBg: "var(--brand)"
    },
    success: {
      fg: "var(--success)",
      bg: "var(--success-tint)",
      solidBg: "var(--success)"
    },
    warning: {
      fg: "#B45309",
      bg: "var(--warning-tint)",
      solidBg: "var(--warning)"
    },
    error: {
      fg: "var(--error)",
      bg: "var(--error-tint)",
      solidBg: "var(--error)"
    },
    info: {
      fg: "var(--info)",
      bg: "var(--info-tint)",
      solidBg: "var(--info)"
    },
    accent: {
      fg: "#0A8F76",
      bg: "var(--teal-tint)",
      solidBg: "var(--accent)"
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 22,
      padding: "0 8px",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      lineHeight: 1,
      color: solid ? "#fff" : t.fg,
      background: solid ? t.solidBg : t.bg,
      borderRadius: "var(--radius-xs)",
      whiteSpace: "nowrap",
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "var(--radius-pill)",
      background: solid ? "#fff" : t.fg,
      flex: "none"
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Orkalis primary action control.
 * Variants: primary (electric blue), secondary (outline), ghost, danger.
 * Sizes: sm / md / lg. Hover lightens, press darkens — never scales.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const sizes = {
    sm: {
      height: 32,
      padding: "0 12px",
      font: "var(--text-sm)",
      gap: 6,
      icon: 16
    },
    md: {
      height: 40,
      padding: "0 16px",
      font: "var(--text-base)",
      gap: 8,
      icon: 18
    },
    lg: {
      height: 48,
      padding: "0 24px",
      font: "var(--text-md)",
      gap: 8,
      icon: 20
    }
  };
  const s = sizes[size] || sizes.md;
  const palettes = {
    primary: {
      bg: active ? "var(--brand-pressed)" : hover ? "var(--brand-hover)" : "var(--brand)",
      color: "#fff",
      border: "transparent"
    },
    secondary: {
      bg: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      color: "var(--text-primary)",
      border: "var(--border-default)"
    },
    ghost: {
      bg: hover ? "var(--surface-sunken)" : "transparent",
      color: "var(--text-secondary)",
      border: "transparent"
    },
    danger: {
      bg: active ? "#C0362B" : hover ? "#F05E54" : "var(--error)",
      color: "#fff",
      border: "transparent"
    }
  };
  const p = palettes[variant] || palettes.primary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.height,
      minHeight: s.height,
      padding: s.padding,
      width: fullWidth ? "100%" : "auto",
      fontFamily: "var(--font-body)",
      fontSize: s.font,
      fontWeight: 600,
      lineHeight: 1,
      color: p.color,
      background: p.bg,
      border: `1px solid ${p.border}`,
      borderRadius: "var(--radius-sm)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      boxShadow: variant === "secondary" ? "var(--shadow-xs)" : "none",
      transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: s.icon,
      height: s.icon
    }
  }, iconLeft), children, iconRight && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: s.icon,
      height: s.icon
    }
  }, iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface container. 1px border + subtle shadow; lifts on hover when
 * interactive. Optional header (title/subtitle/action) and padding control.
 */
function Card({
  children,
  title,
  subtitle,
  action,
  interactive = false,
  padding = "var(--space-6)",
  radius = "var(--radius-md)",
  style = {},
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const hasHeader = title || subtitle || action;
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: radius,
      boxShadow: interactive && hover ? "var(--shadow-md)" : "var(--shadow-sm)",
      cursor: interactive ? "pointer" : "default",
      transition: "box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)",
      borderColor: interactive && hover ? "var(--border-default)" : "var(--border-subtle)",
      overflow: "hidden",
      ...style
    }
  }, rest), hasHeader && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--space-4)",
      padding: `${padding} ${padding} 0`
    }
  }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "var(--text-md)",
      letterSpacing: "-0.02em",
      color: "var(--text-primary)"
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-tertiary)",
      marginTop: 2
    }
  }, subtitle)), action && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none"
    }
  }, action)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Checkbox with label. Controlled via `checked` or uncontrolled.
 * Brand-blue fill when checked; 2px focus ring.
 */
function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const cbId = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: cbId,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-3)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-base)",
      color: "var(--text-primary)",
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      width: 18,
      height: 18,
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: cbId,
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled,
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      width: 18,
      height: 18,
      margin: 0,
      borderRadius: "var(--radius-xs)",
      border: "1px solid var(--border-strong)",
      background: "var(--surface-card)",
      cursor: "inherit",
      transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)"
    }
  }, rest)), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      position: "absolute",
      inset: 0,
      width: 18,
      height: 18,
      padding: 2,
      pointerEvents: "none",
      opacity: 0,
      transition: "opacity var(--dur-fast)"
    },
    "data-check": true
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), label, /*#__PURE__*/React.createElement("style", null, `
        #${cbId.replace(/[:]/g, "\\:")}:checked { background: var(--brand); border-color: var(--brand); }
        #${cbId.replace(/[:]/g, "\\:")}:checked + svg[data-check] { opacity: 1; }
        #${cbId.replace(/[:]/g, "\\:")}:focus-visible { outline: var(--focus-width) solid var(--focus-ring); outline-offset: var(--focus-offset); }
      `));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/core/Dialog.jsx
try { (() => {
/**
 * Centered modal dialog. Overlay scrim + max-width 560px panel, 8px radius,
 * shadow-xl, always-present close (X). Esc and scrim click close it.
 */
function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => e.target === e.currentTarget && onClose && onClose(),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-6)",
      background: "rgba(10, 15, 20, 0.55)",
      backdropFilter: "blur(2px)",
      animation: "ork-fade var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      width: "100%",
      maxWidth: width,
      maxHeight: "calc(100vh - 96px)",
      display: "flex",
      flexDirection: "column",
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xl)",
      overflow: "hidden",
      animation: "ork-pop var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--space-4)",
      padding: "var(--space-5) var(--space-6)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "var(--text-lg)",
      letterSpacing: "-0.02em",
      color: "var(--text-primary)",
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Cerrar",
    onClick: onClose,
    style: {
      display: "inline-flex",
      border: "none",
      background: "transparent",
      color: "var(--text-tertiary)",
      cursor: "pointer",
      padding: 4,
      margin: -4,
      borderRadius: "var(--radius-xs)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-6)",
      overflowY: "auto",
      fontSize: "var(--text-base)",
      color: "var(--text-secondary)",
      lineHeight: "24px"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "var(--space-3)",
      padding: "var(--space-4) var(--space-6)",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--surface-sunken)"
    }
  }, footer)), /*#__PURE__*/React.createElement("style", null, `
        @keyframes ork-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ork-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
      `));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Square icon-only button. Pass a Lucide icon node as children.
 * Variants mirror Button; default is ghost for toolbar density.
 */
function IconButton({
  children,
  variant = "ghost",
  size = "md",
  disabled = false,
  label,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const sizes = {
    sm: 32,
    md: 40,
    lg: 44
  };
  const dim = sizes[size] || sizes.md;
  const palettes = {
    primary: {
      bg: active ? "var(--brand-pressed)" : hover ? "var(--brand-hover)" : "var(--brand)",
      color: "#fff",
      border: "transparent"
    },
    secondary: {
      bg: hover ? "var(--surface-sunken)" : "var(--surface-card)",
      color: "var(--text-primary)",
      border: "var(--border-default)"
    },
    ghost: {
      bg: hover ? "var(--surface-sunken)" : "transparent",
      color: "var(--text-secondary)",
      border: "transparent"
    }
  };
  const p = palettes[variant] || palettes.ghost;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: dim,
      height: dim,
      color: p.color,
      background: p.bg,
      border: `1px solid ${p.border}`,
      borderRadius: "var(--radius-sm)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input with label-above pattern (never placeholder-only).
 * Supports hint, error, and leading/trailing icon nodes.
 */
function Input({
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  hint,
  error,
  disabled = false,
  type = "text",
  iconLeft = null,
  iconRight = null,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || React.useId();
  const borderColor = error ? "var(--error)" : focus ? "var(--brand)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      color: "var(--text-secondary)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      height: 40,
      padding: "0 12px",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-xs)",
      boxShadow: focus ? "0 0 0 2px var(--brand-tint)" : "var(--shadow-xs)",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--text-tertiary)",
      width: 16,
      height: 16
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: undefined,
    onFocusCapture: () => setFocus(true),
    onBlurCapture: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-base)",
      color: "var(--text-primary)"
    }
  }, rest)), iconRight && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--text-tertiary)",
      width: 16,
      height: 16
    }
  }, iconRight)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: error ? "var(--error)" : "var(--text-tertiary)"
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/KpiCard.jsx
try { (() => {
/**
 * KPI metric card — big display number + trend delta. Data is the hero.
 * Trend direction colors the delta (up=success, down=error) unless inverted.
 */
function KpiCard({
  label,
  value,
  delta,
  trend = "up",
  trendLabel,
  invertTrend = false,
  icon = null,
  style = {}
}) {
  const positive = invertTrend ? trend === "down" : trend === "up";
  const deltaColor = delta == null ? "var(--text-tertiary)" : positive ? "var(--success)" : "var(--error)";
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-sm)",
      padding: "var(--space-5)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      color: "var(--text-tertiary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--text-tertiary)",
      width: 18,
      height: 18
    }
  }, icon)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: "var(--text-3xl)",
      lineHeight: 1,
      letterSpacing: "-0.02em",
      color: "var(--text-primary)",
      fontFeatureSettings: '"tnum" 1'
    }
  }, value), delta != null && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "var(--text-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      fontWeight: 600,
      color: deltaColor,
      fontFamily: "var(--font-mono)"
    }
  }, arrow, " ", delta), trendLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)"
    }
  }, trendLabel)));
}
Object.assign(__ds_scope, { KpiCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/KpiCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Native select with Orkalis label-above styling and a chevron.
 * options: array of { value, label } or strings.
 */
function Select({
  label,
  value,
  defaultValue,
  onChange,
  options = [],
  hint,
  error,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const selectId = id || React.useId();
  const norm = options.map(o => typeof o === "string" ? {
    value: o,
    label: o
  } : o);
  const borderColor = error ? "var(--error)" : focus ? "var(--brand)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selectId,
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      color: "var(--text-secondary)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selectId,
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      width: "100%",
      height: 40,
      padding: "0 36px 0 12px",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-xs)",
      boxShadow: focus ? "0 0 0 2px var(--brand-tint)" : "var(--shadow-xs)",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-base)",
      color: "var(--text-primary)",
      cursor: disabled ? "not-allowed" : "pointer",
      outline: "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"
    }
  }, rest), norm.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })))), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: error ? "var(--error)" : "var(--text-tertiary)"
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
/**
 * Toggle switch for binary settings. Controlled or uncontrolled.
 * Teal track when on (settings/positive); brand variant available.
 */
function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  label,
  variant = "brand",
  id,
  style = {}
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const swId = id || React.useId();
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  };
  const onColor = variant === "accent" ? "var(--accent)" : "var(--brand)";
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: swId,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-3)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-base)",
      color: "var(--text-primary)",
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    id: swId,
    role: "switch",
    type: "button",
    "aria-checked": on,
    disabled: disabled,
    onClick: toggle,
    style: {
      position: "relative",
      width: 40,
      height: 24,
      flex: "none",
      borderRadius: "var(--radius-pill)",
      border: "none",
      background: on ? onColor : "var(--gray-300)",
      cursor: "inherit",
      padding: 0,
      transition: "background var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: on ? 18 : 2,
      width: 20,
      height: 20,
      borderRadius: "var(--radius-pill)",
      background: "#fff",
      boxShadow: "var(--shadow-sm)",
      transition: "left var(--dur-base) var(--ease-out)"
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
/**
 * Underline tab bar. Controlled (value/onChange) or uncontrolled.
 * items: array of { value, label, count? }.
 */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  style = {}
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value);
  const active = isControlled ? value : internal;
  const select = v => {
    if (!isControlled) setInternal(v);
    onChange && onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "flex",
      gap: "var(--space-6)",
      borderBottom: "1px solid var(--border-subtle)",
      ...style
    }
  }, items.map(it => {
    const on = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => select(it.value),
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 0 12px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-base)",
        fontWeight: on ? 600 : 500,
        color: on ? "var(--text-primary)" : "var(--text-tertiary)",
        transition: "color var(--dur-fast) var(--ease-out)"
      }
    }, it.label, it.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: on ? "var(--brand)" : "var(--text-tertiary)",
        background: on ? "var(--brand-tint)" : "var(--surface-sunken)",
        borderRadius: "var(--radius-pill)",
        padding: "1px 7px"
      }
    }, it.count), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        background: "var(--brand)",
        borderRadius: "var(--radius-pill)",
        opacity: on ? 1 : 0,
        transition: "opacity var(--dur-fast) var(--ease-out)"
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
/**
 * Removable pill tag (filters, selected facets). Pill radius.
 * Pass onRemove to show the × affordance.
 */
function Tag({
  children,
  onRemove,
  iconLeft = null,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 26,
      padding: onRemove ? "0 6px 0 10px" : "0 12px",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      color: "var(--text-primary)",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-pill)",
      whiteSpace: "nowrap",
      ...style
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--text-tertiary)",
      width: 14,
      height: 14
    }
  }, iconLeft), children, onRemove && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Quitar",
    onClick: onRemove,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 16,
      height: 16,
      border: "none",
      borderRadius: "var(--radius-pill)",
      background: hover ? "var(--surface-sunken)" : "transparent",
      color: "var(--text-tertiary)",
      cursor: "pointer",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/Tooltip.jsx
try { (() => {
/**
 * Lightweight CSS tooltip on hover/focus. Wraps a single trigger child.
 * Navy bubble, 4 placements. No portal — positions absolutely.
 */
function Tooltip({
  children,
  label,
  placement = "top",
  style = {}
}) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top: {
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    bottom: {
      top: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    left: {
      right: "calc(100% + 8px)",
      top: "50%",
      transform: "translateY(-50%)"
    },
    right: {
      left: "calc(100% + 8px)",
      top: "50%",
      transform: "translateY(-50%)"
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      ...style
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocusCapture: () => setShow(true),
    onBlurCapture: () => setShow(false)
  }, children, /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: "absolute",
      zIndex: 50,
      ...pos[placement],
      padding: "6px 10px",
      background: "var(--navy)",
      color: "#fff",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      lineHeight: 1.4,
      whiteSpace: "nowrap",
      borderRadius: "var(--radius-sm)",
      boxShadow: "var(--shadow-lg)",
      opacity: show ? 1 : 0,
      visibility: show ? "visible" : "hidden",
      transition: "opacity var(--dur-fast) var(--ease-out)",
      pointerEvents: "none"
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tooltip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/App.jsx
try { (() => {
/* Orkalis dashboard app shell — sidebar + topbar + view routing + new-invoice dialog. */
const APP_DS = window.OrkalisDesignSystem_0b70cb;
function App() {
  const I = window.OrkIcon;
  const [view, setView] = React.useState("panel");
  const [dark, setDark] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const crumbs = {
    panel: "Panel",
    facturas: "Facturas",
    inventario: "Inventario",
    clientes: "Clientes",
    reportes: "Reportes",
    flujo: "Flujo de caja",
    equipo: "Equipo",
    ajustes: "Ajustes"
  };
  const names = crumbs;
  let content;
  if (view === "panel") content = /*#__PURE__*/React.createElement(window.PanelView, null);else if (view === "facturas") content = /*#__PURE__*/React.createElement(window.FacturasView, {
    onNew: () => setNewOpen(true)
  });else content = /*#__PURE__*/React.createElement(window.EmptyView, {
    name: names[view]
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "100vh",
      width: "100vw",
      background: "var(--surface-page)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(window.Sidebar, {
    active: view,
    onNavigate: setView
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(window.Topbar, {
    crumb: crumbs[view],
    dark: dark,
    onToggleDark: () => setDark(d => !d),
    onPrimary: () => setNewOpen(true)
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto"
    }
  }, content))), /*#__PURE__*/React.createElement(APP_DS.Dialog, {
    open: newOpen,
    onClose: () => setNewOpen(false),
    title: "Nueva factura",
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(APP_DS.Button, {
      variant: "ghost",
      onClick: () => setNewOpen(false)
    }, "Cancelar"), /*#__PURE__*/React.createElement(APP_DS.Button, {
      onClick: () => setNewOpen(false)
    }, "Crear factura"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(APP_DS.Input, {
    label: "Cliente",
    placeholder: "Buscar cliente\u2026",
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "search",
      size: 16
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(APP_DS.Input, {
    label: "Monto (COP)",
    placeholder: "0",
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "dollar-sign",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(APP_DS.Select, {
    label: "Sucursal",
    options: ["Bogotá", "Medellín", "Cali"]
  })), /*#__PURE__*/React.createElement(APP_DS.Input, {
    label: "Vencimiento",
    type: "date"
  }))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Charts.jsx
try { (() => {
/* Lightweight SVG charts for the Orkalis dashboard — brand blue + teal only. */

function AreaChart({
  data,
  height = 220
}) {
  const w = 720,
    h = height,
    pad = 28;
  const max = Math.max(...data.map(d => d.v)) * 1.15;
  const min = 0;
  const x = i => pad + i * (w - pad * 2) / (data.length - 1);
  const y = v => h - pad - (v - min) / (max - min) * (h - pad * 2);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.v)}`).join(" ");
  const area = `${line} L ${x(data.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    style: {
      width: "100%",
      height
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "ork-area",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#1A73E8",
    stopOpacity: "0.18"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#1A73E8",
    stopOpacity: "0"
  }))), [0.25, 0.5, 0.75, 1].map((g, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: pad,
    x2: w - pad,
    y1: pad + (h - pad * 2) * g,
    y2: pad + (h - pad * 2) * g,
    stroke: "var(--border-subtle)",
    strokeWidth: "1"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "url(#ork-area)"
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: "#1A73E8",
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), data.map((d, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, d.peak && /*#__PURE__*/React.createElement("circle", {
    cx: x(i),
    cy: y(d.v),
    r: "4",
    fill: "#1A73E8",
    stroke: "var(--surface-card)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("text", {
    x: x(i),
    y: h - 8,
    textAnchor: "middle",
    fontSize: "11",
    fontFamily: "var(--font-body)",
    fill: "var(--text-tertiary)"
  }, d.label))));
}
function BarMini({
  data,
  height = 80
}) {
  const max = Math.max(...data.map(d => d.v));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 6,
      height
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: `${d.v / max * 100}%`,
      background: d.accent ? "var(--accent)" : "var(--blue)",
      borderRadius: "3px 3px 0 0",
      minHeight: 3
    }
  }))));
}
window.AreaChart = AreaChart;
window.BarMini = BarMini;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Charts.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Sidebar.jsx
try { (() => {
/* Orkalis app sidebar — 240px navy rail, electric-blue active state, 44px rows. */
const {
  Avatar: SB_Avatar,
  Badge: SB_Badge
} = window.OrkalisDesignSystem_0b70cb;
function Sidebar({
  active,
  onNavigate,
  collapsed
}) {
  const I = window.OrkIcon;
  const sections = [{
    title: "Operación",
    items: [{
      id: "panel",
      label: "Panel",
      icon: "layout-dashboard"
    }, {
      id: "facturas",
      label: "Facturas",
      icon: "file-text",
      count: 12
    }, {
      id: "inventario",
      label: "Inventario",
      icon: "package"
    }, {
      id: "clientes",
      label: "Clientes",
      icon: "users"
    }]
  }, {
    title: "Análisis",
    items: [{
      id: "reportes",
      label: "Reportes",
      icon: "bar-chart-3"
    }, {
      id: "flujo",
      label: "Flujo de caja",
      icon: "trending-up"
    }]
  }, {
    title: "Sistema",
    items: [{
      id: "equipo",
      label: "Equipo",
      icon: "user-cog"
    }, {
      id: "ajustes",
      label: "Ajustes",
      icon: "settings"
    }]
  }];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 240,
      flex: "none",
      background: "var(--navy)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRight: "1px solid rgba(255,255,255,0.06)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 64,
      padding: "0 20px",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 48 48",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "5",
    width: "38",
    height: "38",
    rx: "12",
    stroke: "#fff",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "30.5",
    cy: "30.5",
    r: "7.5",
    fill: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      letterSpacing: "-0.04em",
      fontSize: 18
    }
  }, "ORKALIS")), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "8px 12px"
    }
  }, sections.map(sec => /*#__PURE__*/React.createElement("div", {
    key: sec.title,
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#475569",
      padding: "0 12px 8px"
    }
  }, sec.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, sec.items.map(it => {
    const on = active === it.id;
    return /*#__PURE__*/React.createElement(SidebarRow, {
      key: it.id,
      item: it,
      active: on,
      onClick: () => onNavigate(it.id)
    });
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      padding: 12,
      borderTop: "1px solid rgba(255,255,255,0.06)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      borderRadius: "var(--radius-sm)"
    }
  }, /*#__PURE__*/React.createElement(SB_Avatar, {
    name: "Mar\xEDa Restrepo",
    size: 32,
    status: "online"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, "Mar\xEDa Restrepo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#64748B"
    }
  }, "Admin \xB7 Bogot\xE1")), /*#__PURE__*/React.createElement(I, {
    name: "chevrons-up-down",
    size: 16,
    style: {
      color: "#64748B"
    }
  }))));
}
function SidebarRow({
  item,
  active,
  onClick
}) {
  const I = window.OrkIcon;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: 44,
      padding: "0 12px",
      width: "100%",
      border: "none",
      borderRadius: "var(--radius-sm)",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "var(--font-body)",
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      color: active ? "#fff" : hover ? "#E2E8F0" : "#94A3B8",
      background: active ? "var(--blue)" : hover ? "rgba(255,255,255,0.05)" : "transparent",
      transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast)"
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: item.icon,
    size: 18,
    stroke: 2
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, item.label), item.count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 600,
      color: active ? "#fff" : "#94A3B8",
      background: active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
      borderRadius: "var(--radius-pill)",
      padding: "1px 7px"
    }
  }, item.count));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Topbar.jsx
try { (() => {
/* Orkalis app top bar — breadcrumb, search, dark toggle, notifications, primary action. */
const {
  Button: TB_Button,
  IconButton: TB_IconButton,
  Avatar: TB_Avatar
} = window.OrkalisDesignSystem_0b70cb;
function Topbar({
  crumb,
  dark,
  onToggleDark,
  onPrimary
}) {
  const I = window.OrkIcon;
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 64,
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "0 24px",
      background: "var(--surface-card)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Orkalis"), /*#__PURE__*/React.createElement(I, {
    name: "chevron-right",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-primary)",
      fontWeight: 600
    }
  }, crumb)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 36,
      padding: "0 12px",
      width: 260,
      background: "var(--surface-sunken)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-sm)",
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: "search",
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "Buscar\u2026"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      padding: "1px 6px",
      border: "1px solid var(--border-default)",
      borderRadius: 4
    }
  }, "\u2318K")), /*#__PURE__*/React.createElement(TB_IconButton, {
    label: dark ? "Modo claro" : "Modo oscuro",
    variant: "ghost",
    onClick: onToggleDark
  }, /*#__PURE__*/React.createElement(I, {
    name: dark ? "sun" : "moon",
    size: 18
  })), /*#__PURE__*/React.createElement(TB_IconButton, {
    label: "Notificaciones",
    variant: "ghost"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: "bell",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--error)",
      border: "1.5px solid var(--surface-card)"
    }
  }))), /*#__PURE__*/React.createElement(TB_Button, {
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "plus",
      size: 18
    }),
    onClick: onPrimary
  }, "Nueva factura"));
}
window.Topbar = Topbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Topbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Views.jsx
try { (() => {
/* Dashboard views — Panel (KPIs + chart + table) and Facturas (filterable table). */
const DS = window.OrkalisDesignSystem_0b70cb;
const REVENUE = [{
  label: "Ene",
  v: 28
}, {
  label: "Feb",
  v: 31
}, {
  label: "Mar",
  v: 27
}, {
  label: "Abr",
  v: 35
}, {
  label: "May",
  v: 38
}, {
  label: "Jun",
  v: 34
}, {
  label: "Jul",
  v: 41
}, {
  label: "Ago",
  v: 39
}, {
  label: "Sep",
  v: 44
}, {
  label: "Oct",
  v: 43
}, {
  label: "Nov",
  v: 47
}, {
  label: "Dic",
  v: 48,
  peak: true
}];
const INVOICES = [{
  id: "ORK-2026-00471",
  client: "Distribuidora Andina",
  amount: "$4.250.000",
  date: "05 jun 2026",
  status: "pagada"
}, {
  id: "ORK-2026-00470",
  client: "Café del Valle SAS",
  amount: "$1.180.000",
  date: "04 jun 2026",
  status: "pendiente"
}, {
  id: "ORK-2026-00469",
  client: "Textiles Medellín",
  amount: "$8.940.000",
  date: "03 jun 2026",
  status: "pagada"
}, {
  id: "ORK-2026-00468",
  client: "Logística Caribe",
  amount: "$2.310.000",
  date: "02 jun 2026",
  status: "vencida"
}, {
  id: "ORK-2026-00467",
  client: "Ferretería Bolívar",
  amount: "$960.000",
  date: "01 jun 2026",
  status: "pagada"
}, {
  id: "ORK-2026-00466",
  client: "AgroExport Llanos",
  amount: "$12.500.000",
  date: "31 may 2026",
  status: "proceso"
}];
const STATUS_MAP = {
  pagada: {
    tone: "success",
    label: "Pagada"
  },
  pendiente: {
    tone: "warning",
    label: "Pendiente"
  },
  vencida: {
    tone: "error",
    label: "Vencida"
  },
  proceso: {
    tone: "info",
    label: "En proceso"
  }
};
function StatusBadge({
  status
}) {
  const m = STATUS_MAP[status] || STATUS_MAP.pendiente;
  return /*#__PURE__*/React.createElement(DS.Badge, {
    tone: m.tone,
    dot: true
  }, m.label);
}
function InvoiceTable({
  rows,
  dense
}) {
  const I = window.OrkIcon;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "hidden",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--surface-sunken)"
    }
  }, ["Factura", "Cliente", "Monto", "Fecha", "Estado", ""].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 2 ? "right" : "left",
      padding: "10px 16px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--text-tertiary)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    style: {
      background: i % 2 === 1 ? "var(--gray-50)" : "var(--surface-card)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--text-secondary)"
    }
  }, r.id), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      fontWeight: 500,
      color: "var(--text-primary)"
    }
  }, r.client), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      textAlign: "right",
      fontFamily: "var(--font-mono)",
      fontWeight: 500,
      color: "var(--text-primary)",
      fontFeatureSettings: '"tnum" 1'
    }
  }, r.amount), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      color: "var(--text-tertiary)"
    }
  }, r.date), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: r.status
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(DS.IconButton, {
    label: "Opciones",
    size: "sm"
  }, /*#__PURE__*/React.createElement(I, {
    name: "more-horizontal",
    size: 16
  }))))))));
}
function PanelView() {
  const I = window.OrkIcon;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 30,
      lineHeight: "40px"
    }
  }, "Panel de operaci\xF3n"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-tertiary)",
      fontSize: 15,
      margin: "4px 0 0"
    }
  }, "Resumen de tu empresa \xB7 junio 2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(DS.KpiCard, {
    label: "Ingresos del mes",
    value: "$48,25M",
    delta: "12,4%",
    trend: "up",
    trendLabel: "vs. mayo",
    icon: /*#__PURE__*/React.createElement(I, {
      name: "trending-up"
    })
  }), /*#__PURE__*/React.createElement(DS.KpiCard, {
    label: "Facturas activas",
    value: "128",
    delta: "6",
    trend: "up",
    trendLabel: "esta semana",
    icon: /*#__PURE__*/React.createElement(I, {
      name: "file-text"
    })
  }), /*#__PURE__*/React.createElement(DS.KpiCard, {
    label: "Cartera vencida",
    value: "$3,10M",
    delta: "8,0%",
    trend: "down",
    trendLabel: "vs. mayo",
    invertTrend: true,
    icon: /*#__PURE__*/React.createElement(I, {
      name: "alert-circle"
    })
  }), /*#__PURE__*/React.createElement(DS.KpiCard, {
    label: "Clientes activos",
    value: "342",
    delta: "4,2%",
    trend: "up",
    trendLabel: "vs. mayo",
    icon: /*#__PURE__*/React.createElement(I, {
      name: "users"
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(DS.Card, {
    title: "Ingresos",
    subtitle: "Millones COP \xB7 \xFAltimos 12 meses",
    action: /*#__PURE__*/React.createElement(DS.Badge, {
      tone: "accent"
    }, "\u2191 12,4%")
  }, /*#__PURE__*/React.createElement(window.AreaChart, {
    data: REVENUE
  })), /*#__PURE__*/React.createElement(DS.Card, {
    title: "Por sucursal",
    subtitle: "Junio"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(window.BarMini, {
    data: [{
      v: 8
    }, {
      v: 5
    }, {
      v: 9
    }, {
      v: 6
    }, {
      v: 11,
      accent: true
    }, {
      v: 7
    }, {
      v: 9
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, [["Bogotá", "$21,4M", "52%"], ["Medellín", "$14,1M", "29%"], ["Cali", "$8,9M", "19%"]].map(r => /*#__PURE__*/React.createElement("div", {
    key: r[0],
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)"
    }
  }, r[0]), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      color: "var(--text-primary)"
    }
  }, r[1]), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)",
      width: 34,
      textAlign: "right"
    }
  }, r[2])))))))), /*#__PURE__*/React.createElement(DS.Card, {
    title: "Facturas recientes",
    subtitle: "Actividad de los \xFAltimos d\xEDas",
    action: /*#__PURE__*/React.createElement(DS.Button, {
      variant: "ghost",
      size: "sm",
      iconRight: /*#__PURE__*/React.createElement(I, {
        name: "arrow-right",
        size: 16
      })
    }, "Ver todas")
  }, /*#__PURE__*/React.createElement(InvoiceTable, {
    rows: INVOICES.slice(0, 5)
  })));
}
function FacturasView({
  onNew
}) {
  const I = window.OrkIcon;
  const [tab, setTab] = React.useState("todas");
  const filtered = tab === "todas" ? INVOICES : tab === "pend" ? INVOICES.filter(r => r.status === "pendiente" || r.status === "proceso") : INVOICES.filter(r => r.status === "pagada");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 30,
      lineHeight: "40px"
    }
  }, "Facturas"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-tertiary)",
      fontSize: 15,
      margin: "4px 0 0"
    }
  }, "128 documentos \xB7 $48,25M facturados")), /*#__PURE__*/React.createElement(DS.Button, {
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "plus",
      size: 18
    }),
    onClick: onNew
  }, "Nueva factura")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(DS.Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      value: "todas",
      label: "Todas",
      count: 128
    }, {
      value: "pend",
      label: "Pendientes",
      count: 12
    }, {
      value: "pag",
      label: "Pagadas",
      count: 116
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(DS.Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "filter",
      size: 16
    })
  }, "Filtrar"), /*#__PURE__*/React.createElement(DS.Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "download",
      size: 16
    })
  }, "Exportar"))), /*#__PURE__*/React.createElement(InvoiceTable, {
    rows: filtered
  }));
}
window.PanelView = PanelView;
window.FacturasView = FacturasView;
window.EmptyView = function EmptyView({
  name
}) {
  const I = window.OrkIcon;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "80px 20px",
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      padding: 16,
      borderRadius: "var(--radius-md)",
      background: "var(--surface-sunken)",
      color: "var(--text-tertiary)",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: "construction",
    size: 28
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 20,
      color: "var(--text-primary)"
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      maxWidth: 320,
      marginTop: 6
    }
  }, "Esta secci\xF3n es parte del UI kit de demostraci\xF3n. Conecta tus datos para empezar a medir."));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Features.jsx
try { (() => {
/* Orkalis marketing — trust bar, feature grid, stats band. */
const FEAT_DS = window.OrkalisDesignSystem_0b70cb;
function TrustBar() {
  const clients = ["Distribuidora Andina", "Café del Valle", "Textiles Medellín", "Logística Caribe", "AgroExport Llanos"];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "0 40px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: "0 auto",
      borderTop: "1px solid var(--border-subtle)",
      paddingTop: 28
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-tertiary)",
      margin: "0 0 18px"
    }
  }, "M\xE1s de 340 empresas colombianas operan con Orkalis"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 40,
      flexWrap: "wrap"
    }
  }, clients.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: "-0.02em",
      color: "var(--gray-400)"
    }
  }, c)))));
}
function Features() {
  const I = window.OrkIcon;
  const feats = [{
    icon: "package",
    title: "Inventario en tiempo real",
    body: "Controla existencias por sucursal, alertas de stock bajo y costos promedio. Reemplaza el Excel definitivamente."
  }, {
    icon: "file-text",
    title: "Facturación electrónica",
    body: "Emite facturas válidas ante la DIAN en segundos, con numeración y soporte tributario incluidos."
  }, {
    icon: "trending-up",
    title: "Flujo de caja claro",
    body: "Mira entradas, salidas y cartera vencida en un panel. Cierra el mes en 1 día, no en 5."
  }, {
    icon: "users",
    title: "Equipo y permisos",
    body: "Roles por sucursal y área. Cada persona ve exactamente lo que necesita, sin exponer datos sensibles."
  }, {
    icon: "plug",
    title: "Integraciones",
    body: "Conecta tu banco, pasarela de pago y punto de venta. API REST documentada para lo demás."
  }, {
    icon: "shield-check",
    title: "Datos protegidos",
    body: "Respaldo diario, cifrado en tránsito y reposo, y trazabilidad completa de cada movimiento."
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "72px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      marginBottom: 48
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Una sola plataforma"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 38,
      lineHeight: "46px",
      marginTop: 12,
      color: "var(--text-primary)"
    }
  }, "Todo lo que tu operaci\xF3n necesita, sin complicaciones"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: "28px",
      color: "var(--text-secondary)",
      marginTop: 14
    }
  }, "Dise\xF1ado para PYMEs colombianas que dejaron atr\xE1s las hojas de c\xE1lculo y quieren decisiones basadas en datos.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 20
    }
  }, feats.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.title,
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding: 24,
      boxShadow: "var(--shadow-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      padding: 10,
      borderRadius: "var(--radius-sm)",
      background: "var(--brand-tint)",
      color: "var(--brand)",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: f.icon,
    size: 22
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      color: "var(--text-primary)"
    }
  }, f.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: "22px",
      color: "var(--text-secondary)",
      marginTop: 8
    }
  }, f.body))))));
}
function Stats() {
  const stats = [{
    v: "340+",
    l: "empresas activas"
  }, {
    v: "5 → 1",
    l: "días de cierre contable"
  }, {
    v: "$2.400M",
    l: "facturados al mes"
  }, {
    v: "99,9%",
    l: "disponibilidad"
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "0 40px 72px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: "0 auto",
      background: "var(--navy)",
      borderRadius: "var(--radius-xl)",
      padding: "44px 48px",
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 24
    }
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
      paddingLeft: i === 0 ? 0 : 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 40,
      letterSpacing: "-0.02em",
      color: "#fff"
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#94A3B8",
      marginTop: 4
    }
  }, s.l)))));
}
window.TrustBar = TrustBar;
window.Features = Features;
window.Stats = Stats;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Features.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Hero.jsx
try { (() => {
/* Orkalis marketing hero — eyebrow, headline, sub, CTAs, abstract product panel. */
const HERO_DS = window.OrkalisDesignSystem_0b70cb;
function Hero() {
  const I = window.OrkIcon;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      padding: "80px 40px 64px",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      position: "absolute",
      top: -80,
      right: -60,
      opacity: 0.5,
      pointerEvents: "none"
    },
    width: "520",
    height: "520",
    viewBox: "0 0 520 520",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "60",
    y: "60",
    width: "400",
    height: "400",
    rx: "120",
    stroke: "var(--border-subtle)",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "140",
    y: "140",
    width: "240",
    height: "240",
    rx: "72",
    stroke: "var(--border-subtle)",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "360",
    cy: "360",
    r: "60",
    fill: "var(--brand-tint)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "1.05fr 0.95fr",
      gap: 48,
      alignItems: "center",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 12px",
      borderRadius: "var(--radius-pill)",
      background: "var(--teal-tint)",
      color: "#0A8F76",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.02em"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--accent)"
    }
  }), "Plataforma de operaciones"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 56,
      lineHeight: "60px",
      letterSpacing: "-0.02em",
      marginTop: 20,
      color: "var(--text-primary)"
    }
  }, "Tu empresa en control, sin hojas de c\xE1lculo."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 19,
      lineHeight: "30px",
      color: "var(--text-secondary)",
      marginTop: 20,
      maxWidth: 520
    }
  }, "Centraliza inventario, facturaci\xF3n y equipo en una sola plataforma. Implementaci\xF3n en semanas, no en meses."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(HERO_DS.Button, {
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(I, {
      name: "arrow-right",
      size: 20
    })
  }, "Organiza tu operaci\xF3n hoy"), /*#__PURE__*/React.createElement(HERO_DS.Button, {
    size: "lg",
    variant: "secondary",
    iconLeft: /*#__PURE__*/React.createElement(I, {
      name: "play",
      size: 18
    })
  }, "Ver demostraci\xF3n")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20,
      marginTop: 28,
      fontSize: 13,
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: "check",
    size: 15,
    style: {
      color: "var(--success)"
    }
  }), "Sin tarjeta de cr\xE9dito"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: "check",
    size: 15,
    style: {
      color: "var(--success)"
    }
  }), "Soporte en espa\xF1ol"))), /*#__PURE__*/React.createElement(window.HeroPanel, null)));
}

/* Compact dashboard preview panel — sells the product visually. */
function HeroPanel() {
  const I = window.OrkIcon;
  const bars = [42, 55, 38, 61, 48, 70, 58, 76];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--surface-sunken)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "var(--gray-300)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "var(--gray-300)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "var(--gray-300)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--text-tertiary)"
    }
  }, "app.orkalis.co/panel")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-sm)",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-tertiary)"
    }
  }, "Ingresos del mes"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 24,
      color: "var(--text-primary)"
    }
  }, "$48,25M"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--success)"
    }
  }, "\u2191 12,4%")), /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-sm)",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-tertiary)"
    }
  }, "Facturas activas"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 24,
      color: "var(--text-primary)"
    }
  }, "128"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--success)"
    }
  }, "\u2191 6 esta semana"))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-sm)",
      padding: "14px 14px 10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-tertiary)",
      marginBottom: 10
    }
  }, "Ingresos \xB7 8 semanas"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      height: 72
    }
  }, bars.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: `${b}%`,
      background: i === bars.length - 1 ? "var(--accent)" : "var(--blue)",
      borderRadius: "3px 3px 0 0"
    }
  }))))));
}
window.Hero = Hero;
window.HeroPanel = HeroPanel;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/MktNav.jsx
try { (() => {
/* Orkalis marketing top nav — sticky, translucent, logo + links + CTA. */
const MN_DS = window.OrkalisDesignSystem_0b70cb;
function MktNav() {
  const I = window.OrkIcon;
  const links = ["Plataforma", "Soluciones", "Precios", "Recursos"];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 40,
      height: 64,
      display: "flex",
      alignItems: "center",
      gap: 32,
      padding: "0 40px",
      background: "color-mix(in srgb, var(--surface-page) 82%, transparent)",
      backdropFilter: "saturate(180%) blur(12px)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 48 48",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "5",
    width: "38",
    height: "38",
    rx: "12",
    stroke: "var(--navy)",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "30.5",
    cy: "30.5",
    r: "7.5",
    fill: "var(--navy)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      letterSpacing: "-0.04em",
      fontSize: 18,
      color: "var(--text-primary)"
    }
  }, "ORKALIS")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 4
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      padding: "8px 12px",
      fontSize: 14,
      fontWeight: 500,
      color: "var(--text-secondary)",
      borderRadius: "var(--radius-xs)"
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-secondary)",
      whiteSpace: "nowrap"
    }
  }, "Iniciar sesi\xF3n"), /*#__PURE__*/React.createElement(MN_DS.Button, {
    size: "sm",
    iconRight: /*#__PURE__*/React.createElement(I, {
      name: "arrow-right",
      size: 16
    })
  }, "Agenda una demostraci\xF3n"));
}
window.MktNav = MktNav;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/MktNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Sections.jsx
try { (() => {
/* Orkalis marketing — pricing tiers, final CTA, footer. */
const PR_DS = window.OrkalisDesignSystem_0b70cb;
function Pricing() {
  const I = window.OrkIcon;
  const plans = [{
    name: "Esencial",
    price: "$180.000",
    period: "/mes",
    desc: "Para negocios que dejan el Excel.",
    featured: false,
    feats: ["1 sucursal", "Hasta 3 usuarios", "Facturación electrónica", "Inventario básico", "Soporte por correo"]
  }, {
    name: "Operación",
    price: "$420.000",
    period: "/mes",
    desc: "Para PYMEs en crecimiento.",
    featured: true,
    feats: ["Hasta 5 sucursales", "Usuarios ilimitados", "Flujo de caja y reportes", "Roles y permisos", "Integraciones bancarias", "Soporte prioritario"]
  }, {
    name: "Empresa",
    price: "A la medida",
    period: "",
    desc: "Para operaciones complejas.",
    featured: false,
    feats: ["Sucursales ilimitadas", "API y webhooks", "Implementación dedicada", "SLA 99,9%", "Gerente de cuenta"]
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "72px 40px",
      background: "var(--surface-card)",
      borderTop: "1px solid var(--border-subtle)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      maxWidth: 580,
      margin: "0 auto 48px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Precios"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 38,
      lineHeight: "46px",
      marginTop: 12,
      color: "var(--text-primary)"
    }
  }, "Planes claros, sin sorpresas"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      color: "var(--text-secondary)",
      marginTop: 14
    }
  }, "Precios en pesos colombianos. Cambia o cancela cuando quieras.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 20,
      alignItems: "start"
    }
  }, plans.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      background: p.featured ? "var(--navy)" : "var(--surface-page)",
      border: p.featured ? "none" : "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding: 28,
      boxShadow: p.featured ? "var(--shadow-lg)" : "none",
      position: "relative"
    }
  }, p.featured && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 20,
      right: 20,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--navy)",
      background: "var(--accent)",
      padding: "3px 10px",
      borderRadius: "var(--radius-pill)"
    }
  }, "Recomendado"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      color: p.featured ? "#fff" : "var(--text-primary)"
    }
  }, p.name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: p.featured ? "#94A3B8" : "var(--text-tertiary)",
      marginTop: 4,
      minHeight: 36
    }
  }, p.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 4,
      margin: "12px 0 20px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 34,
      letterSpacing: "-0.02em",
      color: p.featured ? "#fff" : "var(--text-primary)"
    }
  }, p.price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: p.featured ? "#94A3B8" : "var(--text-tertiary)"
    }
  }, p.period)), /*#__PURE__*/React.createElement(PR_DS.Button, {
    fullWidth: true,
    variant: p.featured ? "primary" : "secondary"
  }, p.name === "Empresa" ? "Contactar ventas" : "Empezar ahora"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      marginTop: 22
    }
  }, p.feats.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 14,
      color: p.featured ? "#E2E8F0" : "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement(I, {
    name: "check",
    size: 16,
    style: {
      color: p.featured ? "var(--accent)" : "var(--brand)",
      flex: "none"
    }
  }), f))))))));
}
function FinalCTA() {
  const I = window.OrkIcon;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "80px 40px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 680,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 44,
      lineHeight: "52px",
      letterSpacing: "-0.02em",
      color: "var(--text-primary)"
    }
  }, "Automatiza tu operaci\xF3n sin complicaciones"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      color: "var(--text-secondary)",
      marginTop: 16
    }
  }, "Agenda una demostraci\xF3n de 30 minutos. Te mostramos c\xF3mo se ver\xEDa tu empresa en Orkalis."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "center",
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(PR_DS.Button, {
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(I, {
      name: "arrow-right",
      size: 20
    })
  }, "Agenda una demostraci\xF3n"), /*#__PURE__*/React.createElement(PR_DS.Button, {
    size: "lg",
    variant: "secondary"
  }, "Hablar con ventas"))));
}
function Footer() {
  const cols = [{
    h: "Producto",
    items: ["Plataforma", "Inventario", "Facturación", "Precios", "Integraciones"]
  }, {
    h: "Empresa",
    items: ["Nosotros", "Clientes", "Empleo", "Contacto"]
  }, {
    h: "Recursos",
    items: ["Documentación", "API", "Estado del servicio", "Blog"]
  }, {
    h: "Legal",
    items: ["Términos", "Privacidad", "Tratamiento de datos"]
  }];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--navy)",
      color: "#94A3B8",
      padding: "56px 40px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr repeat(4, 1fr)",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 48 48",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "5",
    width: "38",
    height: "38",
    rx: "12",
    stroke: "#fff",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "30.5",
    cy: "30.5",
    r: "7.5",
    fill: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      letterSpacing: "-0.04em",
      fontSize: 18,
      color: "#fff"
    }
  }, "ORKALIS")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      lineHeight: "20px",
      maxWidth: 240
    }
  }, "Software de operaciones para PYMEs en Latinoam\xE9rica. Bogot\xE1, Colombia.")), cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "#fff",
      marginBottom: 12
    }
  }, c.h), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, c.items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it,
    href: "#",
    style: {
      fontSize: 13,
      color: "#94A3B8"
    }
  }, it)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 40,
      paddingTop: 20,
      borderTop: "1px solid rgba(255,255,255,0.08)",
      fontSize: 12,
      color: "#64748B"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Orkalis Software Solutions S.A.S. NIT 901.XXX.XXX-X"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)"
    }
  }, "Hecho en Colombia"))));
}
window.Pricing = Pricing;
window.FinalCTA = FinalCTA;
window.Footer = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Site.jsx
try { (() => {
/* Orkalis marketing site — single scroll page assembly. */
function Site() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100vh"
    }
  }, /*#__PURE__*/React.createElement(window.MktNav, null), /*#__PURE__*/React.createElement(window.Hero, null), /*#__PURE__*/React.createElement(window.TrustBar, null), /*#__PURE__*/React.createElement(window.Features, null), /*#__PURE__*/React.createElement(window.Stats, null), /*#__PURE__*/React.createElement(window.Pricing, null), /*#__PURE__*/React.createElement(window.FinalCTA, null), /*#__PURE__*/React.createElement(window.Footer, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(Site, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Site.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.KpiCard = __ds_scope.KpiCard;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Tooltip = __ds_scope.Tooltip;

})();
