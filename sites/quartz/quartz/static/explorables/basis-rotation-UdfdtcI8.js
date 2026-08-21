/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const R=globalThis,W=R.ShadowRoot&&(R.ShadyCSS===void 0||R.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ct=Symbol(),K=new WeakMap;let _t=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==ct)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(W&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=K.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&K.set(e,t))}return t}toString(){return this.cssText}};const yt=r=>new _t(typeof r=="string"?r:r+"",void 0,ct),gt=(r,t)=>{if(W)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),i=R.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=e.cssText,r.appendChild(s)}},X=W?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return yt(e)})(r):r;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:vt,defineProperty:bt,getOwnPropertyDescriptor:At,getOwnPropertyNames:xt,getOwnPropertySymbols:Et,getPrototypeOf:wt}=Object,L=globalThis,G=L.trustedTypes,St=G?G.emptyScript:"",Ct=L.reactiveElementPolyfillSupport,O=(r,t)=>r,z={toAttribute(r,t){switch(t){case Boolean:r=r?St:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},V=(r,t)=>!vt(r,t),Q={attribute:!0,type:String,converter:z,reflect:!1,useDefault:!1,hasChanged:V};Symbol.metadata??=Symbol("metadata"),L.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Q){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);i!==void 0&&bt(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:n}=At(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:i,set(o){const h=i?.call(this);n?.call(this,o),this.requestUpdate(t,h,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Q}static _$Ei(){if(this.hasOwnProperty(O("elementProperties")))return;const t=wt(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(O("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(O("properties"))){const e=this.properties,s=[...xt(e),...Et(e)];for(const i of s)this.createProperty(i,e[i])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,i]of e)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const i=this._$Eu(e,s);i!==void 0&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)e.unshift(X(i))}else t!==void 0&&e.push(X(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return gt(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const n=(s.converter?.toAttribute!==void 0?s.converter:z).toAttribute(e,s.type);this._$Em=t,n==null?this.removeAttribute(i):this.setAttribute(i,n),this._$Em=null}}_$AK(t,e){const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const n=s.getPropertyOptions(i),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:z;this._$Em=i;const h=o.fromAttribute(e,n.type);this[i]=h??this._$Ej?.get(i)??h,this._$Em=null}}requestUpdate(t,e,s,i=!1,n){if(t!==void 0){const o=this.constructor;if(i===!1&&(n=this[t]),s??=o.getPropertyOptions(t),!((s.hasChanged??V)(n,e)||s.useDefault&&s.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:n},o){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),i===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,n]of this._$Ep)this[i]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,n]of s){const{wrapped:o}=n,h=this[i];o!==!0||this._$AL.has(i)||h===void 0||this.C(i,void 0,n,h)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[O("elementProperties")]=new Map,x[O("finalized")]=new Map,Ct?.({ReactiveElement:x}),(L.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Y=globalThis,tt=r=>r,D=Y.trustedTypes,et=D?D.createPolicy("lit-html",{createHTML:r=>r}):void 0,dt="$lit$",y=`lit$${Math.random().toFixed(9).slice(2)}$`,pt="?"+y,Pt=`<${pt}>`,A=document,M=()=>A.createComment(""),k=r=>r===null||typeof r!="object"&&typeof r!="function",Z=Array.isArray,Ot=r=>Z(r)||typeof r?.[Symbol.iterator]=="function",B=`[ 	
\f\r]`,P=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,st=/-->/g,it=/>/g,g=RegExp(`>|${B}(?:([^\\s"'>=/]+)(${B}*=${B}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),rt=/'/g,nt=/"/g,ut=/^(?:script|style|textarea|title)$/i,$t=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),F=$t(1),q=$t(2),w=Symbol.for("lit-noChange"),d=Symbol.for("lit-nothing"),ot=new WeakMap,b=A.createTreeWalker(A,129);function ft(r,t){if(!Z(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return et!==void 0?et.createHTML(t):t}const Ut=(r,t)=>{const e=r.length-1,s=[];let i,n=t===2?"<svg>":t===3?"<math>":"",o=P;for(let h=0;h<e;h++){const a=r[h];let c,p,l=-1,$=0;for(;$<a.length&&(o.lastIndex=$,p=o.exec(a),p!==null);)$=o.lastIndex,o===P?p[1]==="!--"?o=st:p[1]!==void 0?o=it:p[2]!==void 0?(ut.test(p[2])&&(i=RegExp("</"+p[2],"g")),o=g):p[3]!==void 0&&(o=g):o===g?p[0]===">"?(o=i??P,l=-1):p[1]===void 0?l=-2:(l=o.lastIndex-p[2].length,c=p[1],o=p[3]===void 0?g:p[3]==='"'?nt:rt):o===nt||o===rt?o=g:o===st||o===it?o=P:(o=g,i=void 0);const f=o===g&&r[h+1].startsWith("/>")?" ":"";n+=o===P?a+Pt:l>=0?(s.push(c),a.slice(0,l)+dt+a.slice(l)+y+f):a+y+(l===-2?h:f)}return[ft(r,n+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class H{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let n=0,o=0;const h=t.length-1,a=this.parts,[c,p]=Ut(t,e);if(this.el=H.createElement(c,s),b.currentNode=this.el.content,e===2||e===3){const l=this.el.content.firstChild;l.replaceWith(...l.childNodes)}for(;(i=b.nextNode())!==null&&a.length<h;){if(i.nodeType===1){if(i.hasAttributes())for(const l of i.getAttributeNames())if(l.endsWith(dt)){const $=p[o++],f=i.getAttribute(l).split(y),N=/([.?@])?(.*)/.exec($);a.push({type:1,index:n,name:N[2],strings:f,ctor:N[1]==="."?kt:N[1]==="?"?Ht:N[1]==="@"?Tt:j}),i.removeAttribute(l)}else l.startsWith(y)&&(a.push({type:6,index:n}),i.removeAttribute(l));if(ut.test(i.tagName)){const l=i.textContent.split(y),$=l.length-1;if($>0){i.textContent=D?D.emptyScript:"";for(let f=0;f<$;f++)i.append(l[f],M()),b.nextNode(),a.push({type:2,index:++n});i.append(l[$],M())}}}else if(i.nodeType===8)if(i.data===pt)a.push({type:2,index:n});else{let l=-1;for(;(l=i.data.indexOf(y,l+1))!==-1;)a.push({type:7,index:n}),l+=y.length-1}n++}}static createElement(t,e){const s=A.createElement("template");return s.innerHTML=t,s}}function S(r,t,e=r,s){if(t===w)return t;let i=s!==void 0?e._$Co?.[s]:e._$Cl;const n=k(t)?void 0:t._$litDirective$;return i?.constructor!==n&&(i?._$AO?.(!1),n===void 0?i=void 0:(i=new n(r),i._$AT(r,e,s)),s!==void 0?(e._$Co??=[])[s]=i:e._$Cl=i),i!==void 0&&(t=S(r,i._$AS(r,t.values),i,s)),t}class Mt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=(t?.creationScope??A).importNode(e,!0);b.currentNode=i;let n=b.nextNode(),o=0,h=0,a=s[0];for(;a!==void 0;){if(o===a.index){let c;a.type===2?c=new T(n,n.nextSibling,this,t):a.type===1?c=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(c=new Nt(n,this,t)),this._$AV.push(c),a=s[++h]}o!==a?.index&&(n=b.nextNode(),o++)}return b.currentNode=A,i}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class T{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=d,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=S(this,t,e),k(t)?t===d||t==null||t===""?(this._$AH!==d&&this._$AR(),this._$AH=d):t!==this._$AH&&t!==w&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Ot(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==d&&k(this._$AH)?this._$AA.nextSibling.data=t:this.T(A.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=H.createElement(ft(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(e);else{const n=new Mt(i,this),o=n.u(this.options);n.p(e),this.T(o),this._$AH=n}}_$AC(t){let e=ot.get(t.strings);return e===void 0&&ot.set(t.strings,e=new H(t)),e}k(t){Z(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const n of t)i===e.length?e.push(s=new T(this.O(M()),this.O(M()),this,this.options)):s=e[i],s._$AI(n),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const s=tt(t).nextSibling;tt(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class j{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,n){this.type=1,this._$AH=d,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=n,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=d}_$AI(t,e=this,s,i){const n=this.strings;let o=!1;if(n===void 0)t=S(this,t,e,0),o=!k(t)||t!==this._$AH&&t!==w,o&&(this._$AH=t);else{const h=t;let a,c;for(t=n[0],a=0;a<n.length-1;a++)c=S(this,h[s+a],e,a),c===w&&(c=this._$AH[a]),o||=!k(c)||c!==this._$AH[a],c===d?t=d:t!==d&&(t+=(c??"")+n[a+1]),this._$AH[a]=c}o&&!i&&this.j(t)}j(t){t===d?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class kt extends j{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===d?void 0:t}}class Ht extends j{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==d)}}class Tt extends j{constructor(t,e,s,i,n){super(t,e,s,i,n),this.type=5}_$AI(t,e=this){if((t=S(this,t,e,0)??d)===w)return;const s=this._$AH,i=t===d&&s!==d||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,n=t!==d&&(s===d||i);i&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class Nt{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){S(this,t)}}const Rt=Y.litHtmlPolyfillSupport;Rt?.(H,T),(Y.litHtmlVersions??=[]).push("3.3.3");const zt=(r,t,e)=>{const s=e?.renderBefore??t;let i=s._$litPart$;if(i===void 0){const n=e?.renderBefore??null;s._$litPart$=i=new T(t.insertBefore(M(),n),n,void 0,e??{})}return i._$AI(r),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const J=globalThis;class U extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=zt(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return w}}U._$litElement$=!0,U.finalized=!0,J.litElementHydrateSupport?.({LitElement:U});const Dt=J.litElementPolyfillSupport;Dt?.({LitElement:U});(J.litElementVersions??=[]).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Lt=r=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(r,t)}):customElements.define(r,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const jt={attribute:!0,type:String,converter:z,reflect:!1,hasChanged:V},It=(r=jt,t,e)=>{const{kind:s,metadata:i}=e;let n=globalThis.litPropertyMetadata.get(i);if(n===void 0&&globalThis.litPropertyMetadata.set(i,n=new Map),s==="setter"&&((r=Object.create(r)).wrapped=!0),n.set(e.name,r),s==="accessor"){const{name:o}=e;return{set(h){const a=t.get.call(this);t.set.call(this,h),this.requestUpdate(o,a,r,!0,h)},init(h){return h!==void 0&&this.C(o,void 0,r,h),h}}}if(s==="setter"){const{name:o}=e;return function(h){const a=this[o];t.call(this,h),this.requestUpdate(o,a,r,!0,h)}}throw Error("Unsupported decorator location: "+s)};function I(r){return(t,e)=>typeof e=="object"?It(r,t,e):((s,i,n)=>{const o=i.hasOwnProperty(n);return i.constructor.createProperty(n,s),o?Object.getOwnPropertyDescriptor(i,n):void 0})(r,t,e)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function mt(r){return I({...r,state:!0,attribute:!1})}var Bt=Object.defineProperty,Ft=Object.getOwnPropertyDescriptor,C=(r,t,e,s)=>{for(var i=s>1?void 0:s?Ft(t,e):t,n=r.length-1,o;n>=0;n--)(o=r[n])&&(i=(s?o(t,e,i):o(i))||i);return s&&i&&Bt(t,e,i),i};const at=60,u=160,m=2.2,E="#2f7ff0",v="#e0483d",ht="#8a8f98",lt="explorables-basis-rotation",qt=`
.br { margin: 1.5rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.br-svg { width: 100%; max-width: 22rem; height: auto; touch-action: manipulation; }
.br-control { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 0.5rem 0.75rem; width: 100%; max-width: 26rem; font-size: 0.9rem; }
.br-control input[type="range"] { flex: 1 1 12rem; min-width: 8rem; accent-color: ${v}; }
.br-control output { font-variant-numeric: tabular-nums; min-width: 3.5em; text-align: right; }
.br-eq { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 0.35rem; font-size: 0.85rem; line-height: 1.15; }
.br-term { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.br-mat { position: relative; display: grid; grid-template-rows: repeat(2, 1fr);
  grid-auto-flow: column; gap: 0.1em 0.5em; padding: 0.2em 0.5em;
  font-variant-numeric: tabular-nums; }
.br-mat > span { text-align: right; }
.br-mat::before, .br-mat::after { content: ""; position: absolute; top: 0; bottom: 0;
  width: 0.28em; border: 1.5px solid currentColor; }
.br-mat::before { left: 0; border-right: 0; }
.br-mat::after { right: 0; border-left: 0; }
.br-label { font-size: 0.75rem; opacity: 0.75; }
.br-std { color: ${E}; }
.br-rot { color: ${v}; }
@media (prefers-reduced-motion: no-preference) { .br-svg line, .br-svg text { transition: none; } }
`;function Wt(){const r=globalThis.document;if(!r||r.getElementById(lt))return;const t=r.createElement("style");t.id=lt,t.textContent=qt,r.head.appendChild(t)}let _=class extends U{constructor(){super(...arguments),this.vx=1,this.vy=1.6,this.theta=30,this.live=30,this.description="",this.frame=0,this.pending=null,this.onInput=r=>{this.pending=Number(r.target.value),!this.frame&&(this.frame=requestAnimationFrame(()=>{this.frame=0,this.pending!==null&&(this.live=this.pending)}))}}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),Wt(),this.live=this.theta;const r=this.querySelector("img");r&&(this.description=r.getAttribute("alt")??""),this.replaceChildren()}disconnectedCallback(){super.disconnectedCallback(),this.frame&&cancelAnimationFrame(this.frame),this.frame=0}static px(r){return u+r*at}static py(r){return u-r*at}axis(r,t,e,s){const{px:i,py:n}=_;return q`
      <line x1=${u} y1=${u} x2=${i(r*m)} y2=${n(t*m)}
            stroke=${e} stroke-width="1.6" marker-end="url(#br-tip-${e.slice(1)})"/>
      <line x1=${u} y1=${u} x2=${i(-r*m)} y2=${n(-t*m)}
            stroke=${e} stroke-width="0.8" opacity="0.4"/>
      <text x=${i(r*m*1.08)} y=${n(t*m*1.08)} fill=${e}
            font-size="13" text-anchor="middle" dominant-baseline="middle">${s}</text>
    `}render(){const{px:r,py:t}=_,e=this.live*Math.PI/180,s=Math.cos(e),i=Math.sin(e),n=s*this.vx+i*this.vy,o=-i*this.vx+s*this.vy,h=[n*s,n*i],a=[o*-i,o*s],c=(l,$,f)=>q`
      <line x1=${r(this.vx)} y1=${t(this.vy)} x2=${r(l)} y2=${t($)}
            stroke=${f} stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
    `,p=this.description?`${this.description} Basis currently rotated ${this.live.toFixed(0)} degrees.`:`A vector at ${this.vx} and ${this.vy}, measured against a standard basis and a basis rotated ${this.live.toFixed(0)} degrees.`;return F`
      <figure class="br">
        <svg class="br-svg" viewBox="0 0 320 320" role="img" aria-label=${p}>
          <defs>
            ${[E,v].map(l=>q`
              <marker id="br-tip-${l.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill=${l}/>
              </marker>`)}
            <marker id="br-tip-vec" viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
            </marker>
          </defs>

          <line x1=${r(-m)} y1=${u} x2=${r(m)} y2=${u}
                stroke=${ht} stroke-width="0.5" opacity="0.3"/>
          <line x1=${u} y1=${t(-m)} x2=${u} y2=${t(m)}
                stroke=${ht} stroke-width="0.5" opacity="0.3"/>

          ${this.axis(1,0,E,"ê₁")} ${this.axis(0,1,E,"ê₂")}
          ${this.axis(s,i,v,"ê₁′")} ${this.axis(-i,s,v,"ê₂′")}

          ${c(this.vx,0,E)} ${c(0,this.vy,E)}
          ${c(h[0],h[1],v)} ${c(a[0],a[1],v)}

          <line x1=${u} y1=${u} x2=${r(this.vx)} y2=${t(this.vy)}
                stroke="currentColor" stroke-width="2.6" marker-end="url(#br-tip-vec)"/>
          <text x=${r(this.vx)+10} y=${t(this.vy)-8} fill="currentColor"
                font-size="14" font-weight="600">V</text>
        </svg>

        <label class="br-control">
          <span>rotate the basis θ</span>
          <input type="range" min="-90" max="90" step="1" .value=${String(this.live)}
                 aria-label="rotate the basis, degrees" @input=${this.onInput}>
          <output>${this.live.toFixed(0)}°</output>
        </label>

        <div class="br-eq">
          ${this.term(["1.00","0.00","0.00","1.00"],"[ê₁ ê₂]","br-std")}
          ${this.term([this.vx.toFixed(2),this.vy.toFixed(2)],"x","br-std")}
          <span>=</span>
          ${this.term([s.toFixed(2),i.toFixed(2),(-i).toFixed(2),s.toFixed(2)],"[ê₁′ ê₂′]","br-rot")}
          ${this.term([n.toFixed(2),o.toFixed(2)],"x′","br-rot")}
        </div>
      </figure>
    `}term(r,t,e){return F`
      <span class="br-term ${e}">
        <span class="br-mat">${r.map(s=>F`<span>${s}</span>`)}</span>
        <span class="br-label">${t}</span>
      </span>
      ${d}
    `}};C([I({type:Number})],_.prototype,"vx",2);C([I({type:Number})],_.prototype,"vy",2);C([I({type:Number})],_.prototype,"theta",2);C([mt()],_.prototype,"live",2);C([mt()],_.prototype,"description",2);_=C([Lt("basis-rotation")],_);export{_ as BasisRotation};
