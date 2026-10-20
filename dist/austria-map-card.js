/*! Austria Map Card — bundled by Rolldown. Edit sources in src/, then `npm run build`. */
var e=Object.defineProperty,t=(t,n)=>{let r={};for(var i in t)e(r,i,{get:t[i],enumerable:!0});return n||e(r,Symbol.toStringTag,{value:`Module`}),r};
/**
* @license
* Copyright 2019 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
const n=globalThis,r=n.ShadowRoot&&(n.ShadyCSS===void 0||n.ShadyCSS.nativeShadow)&&`adoptedStyleSheets`in Document.prototype&&`replace`in CSSStyleSheet.prototype,i=Symbol(),a=/* @__PURE__ */ new WeakMap;var o=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(r&&e===void 0){let n=t!==void 0&&t.length===1;n&&(e=a.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),n&&a.set(t,e))}return e}toString(){return this.cssText}};const s=e=>new o(typeof e==`string`?e:e+``,void 0,i),c=(e,...t)=>new o(e.length===1?e[0]:t.reduce((t,n,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if(typeof e==`number`)return e;throw Error(`Value passed to 'css' function must be a 'css' function result: `+e+`. Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.`)})(n)+e[r+1],e[0]),e,i),l=(e,t)=>{if(r)e.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let r of t){let t=document.createElement(`style`),i=n.litNonce;i!==void 0&&t.setAttribute(`nonce`,i),t.textContent=r.cssText,e.appendChild(t)}},u=r?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t=``;for(let n of e.cssRules)t+=n.cssText;return s(t)})(e):e,{is:d,defineProperty:f,getOwnPropertyDescriptor:p,getOwnPropertyNames:m,getOwnPropertySymbols:h,getPrototypeOf:g}=Object,_=globalThis,v=_.trustedTypes,y=v?v.emptyScript:``,b=_.reactiveElementPolyfillSupport,x=(e,t)=>e,S={toAttribute(e,t){
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
switch(t){case Boolean:e=e?y:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let n=e;switch(t){case Boolean:n=e!==null;break;case Number:n=e===null?null:Number(e);break;case Object:case Array:try{n=JSON.parse(e)}catch{n=null}}return n}},C=(e,t)=>!d(e,t),w={attribute:!0,type:String,converter:S,reflect:!1,useDefault:!1,hasChanged:C};Symbol.metadata??=Symbol(`metadata`),_.litPropertyMetadata??=/* @__PURE__ */ new WeakMap;var T=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=w){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let n=Symbol(),r=this.getPropertyDescriptor(e,n,t);r!==void 0&&f(this.prototype,e,r)}}static getPropertyDescriptor(e,t,n){let{get:r,set:i}=p(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){let a=r?.call(this);i?.call(this,t),this.requestUpdate(e,a,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??w}static _$Ei(){if(this.hasOwnProperty(x(`elementProperties`)))return;let e=g(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(x(`finalized`)))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(x(`properties`))){let e=this.properties,t=[...m(e),...h(e)];for(let n of t)this.createProperty(n,e[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[e,n]of t)this.elementProperties.set(e,n)}this._$Eh=/* @__PURE__ */ new Map;for(let[e,t]of this.elementProperties){let n=this._$Eu(e,t);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let n=new Set(e.flat(1/0).reverse());for(let e of n)t.unshift(u(e))}else e!==void 0&&t.push(u(e));return t}static _$Eu(e,t){let n=t.attribute;return!1===n?void 0:typeof n==`string`?n:typeof e==`string`?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=/* @__PURE__ */ new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=/* @__PURE__ */ new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=/* @__PURE__ */ new Map,t=this.constructor.elementProperties;for(let n of t.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return l(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,n){this._$AK(e,n)}_$ET(e,t){let n=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,n);if(r!==void 0&&!0===n.reflect){let i=(n.converter?.toAttribute===void 0?S:n.converter).toAttribute(t,n.type);this._$Em=e,i==null?this.removeAttribute(r):this.setAttribute(r,i),this._$Em=null}}_$AK(e,t){let n=this.constructor,r=n._$Eh.get(e);if(r!==void 0&&this._$Em!==r){let e=n.getPropertyOptions(r),i=typeof e.converter==`function`?{fromAttribute:e.converter}:e.converter?.fromAttribute===void 0?S:e.converter;this._$Em=r;let a=i.fromAttribute(t,e.type);this[r]=a??this._$Ej?.get(r)??a,this._$Em=null}}requestUpdate(e,t,n,r=!1,i){if(e!==void 0){let a=this.constructor;if(!1===r&&(i=this[e]),n??=a.getPropertyOptions(e),!((n.hasChanged??C)(i,t)||n.useDefault&&n.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,n))))return;this.C(e,t,n)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:n,reflect:r,wrapped:i},a){n&&!(this._$Ej??=/* @__PURE__ */ new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),!0!==i||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??=/* @__PURE__ */ new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}let e=this.constructor.elementProperties;if(e.size>0)for(let[t,n]of e){let{wrapped:e}=n,r=this[t];!0!==e||this._$AL.has(t)||r===void 0||this.C(t,void 0,n,r)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=/* @__PURE__ */ new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};T.elementStyles=[],T.shadowRootOptions={mode:`open`},T[x(`elementProperties`)]=/* @__PURE__ */ new Map,T[x(`finalized`)]=/* @__PURE__ */ new Map,b?.({ReactiveElement:T}),(_.reactiveElementVersions??=[]).push(`2.1.2`);
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
const ee=globalThis,te=e=>e,ne=ee.trustedTypes,re=ne?ne.createPolicy(`lit-html`,{createHTML:e=>e}):void 0,ie=`$lit$`,E=`lit$${Math.random().toFixed(9).slice(2)}$`,ae=`?`+E,oe=`<${ae}>`,D=document,se=()=>D.createComment(``),ce=e=>e===null||typeof e!=`object`&&typeof e!=`function`,le=Array.isArray,ue=e=>le(e)||typeof e?.[Symbol.iterator]==`function`,de=`[ 	
\f\r]`,fe=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,pe=/-->/g,me=/>/g,O=RegExp(`>|${de}(?:([^\\s"'>=/]+)(${de}*=${de}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,`g`),he=/'/g,ge=/"/g,_e=/^(?:script|style|textarea|title)$/i,k=(e=>(t,...n)=>({_$litType$:e,strings:t,values:n}))(1),A=Symbol.for(`lit-noChange`),j=Symbol.for(`lit-nothing`),ve=/* @__PURE__ */ new WeakMap,M=D.createTreeWalker(D,129);function ye(e,t){if(!le(e)||!e.hasOwnProperty(`raw`))throw Error(`invalid template strings array`);return re===void 0?t:re.createHTML(t)}const be=(e,t)=>{let n=e.length-1,r=[],i,a=t===2?`<svg>`:t===3?`<math>`:``,o=fe;for(let t=0;t<n;t++){let n=e[t],s,c,l=-1,u=0;for(;u<n.length&&(o.lastIndex=u,c=o.exec(n),c!==null);)u=o.lastIndex,o===fe?c[1]===`!--`?o=pe:c[1]===void 0?c[2]===void 0?c[3]!==void 0&&(o=O):(_e.test(c[2])&&(i=RegExp(`</`+c[2],`g`)),o=O):o=me:o===O?c[0]===`>`?(o=i??fe,l=-1):c[1]===void 0?l=-2:(l=o.lastIndex-c[2].length,s=c[1],o=c[3]===void 0?O:c[3]===`"`?ge:he):o===ge||o===he?o=O:o===pe||o===me?o=fe:(o=O,i=void 0);let d=o===O&&e[t+1].startsWith(`/>`)?` `:``;a+=o===fe?n+oe:l>=0?(r.push(s),n.slice(0,l)+ie+n.slice(l)+E+d):n+E+(l===-2?t:d)}return[ye(e,a+(e[n]||`<?>`)+(t===2?`</svg>`:t===3?`</math>`:``)),r]};var xe=class e{constructor({strings:t,_$litType$:n},r){let i;this.parts=[];let a=0,o=0,s=t.length-1,c=this.parts,[l,u]=be(t,n);if(this.el=e.createElement(l,r),M.currentNode=this.el.content,n===2||n===3){let e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;(i=M.nextNode())!==null&&c.length<s;){if(i.nodeType===1){if(i.hasAttributes())for(let e of i.getAttributeNames())if(e.endsWith(ie)){let t=u[o++],n=i.getAttribute(e).split(E),r=/([.?@])?(.*)/.exec(t);c.push({type:1,index:a,name:r[2],strings:n,ctor:r[1]===`.`?Te:r[1]===`?`?Ee:r[1]===`@`?De:we}),i.removeAttribute(e)}else e.startsWith(E)&&(c.push({type:6,index:a}),i.removeAttribute(e));if(_e.test(i.tagName)){let e=i.textContent.split(E),t=e.length-1;if(t>0){i.textContent=ne?ne.emptyScript:``;for(let n=0;n<t;n++)i.append(e[n],se()),M.nextNode(),c.push({type:2,index:++a});i.append(e[t],se())}}}else if(i.nodeType===8){if(i.data===ae)c.push({type:2,index:a});else{let e=-1;for(;(e=i.data.indexOf(E,e+1))!==-1;)c.push({type:7,index:a}),e+=E.length-1}}a++}}static createElement(e,t){let n=D.createElement(`template`);return n.innerHTML=e,n}};function N(e,t,n=e,r){if(t===A)return t;let i=r===void 0?n._$Cl:n._$Co?.[r],a=ce(t)?void 0:t._$litDirective$;return i?.constructor!==a&&(i?._$AO?.(!1),a===void 0?i=void 0:(i=new a(e),i._$AT(e,n,r)),r===void 0?n._$Cl=i:(n._$Co??=[])[r]=i),i!==void 0&&(t=N(e,i._$AS(e,t.values),i,r)),t}var Se=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:n}=this._$AD,r=(e?.creationScope??D).importNode(t,!0);M.currentNode=r;let i=M.nextNode(),a=0,o=0,s=n[0];for(;s!==void 0;){if(a===s.index){let t;s.type===2?t=new Ce(i,i.nextSibling,this,e):s.type===1?t=new s.ctor(i,s.name,s.strings,this,e):s.type===6&&(t=new Oe(i,this,e)),this._$AV.push(t),s=n[++o]}a!==s?.index&&(i=M.nextNode(),a++)}return M.currentNode=D,r}p(e){let t=0;for(let n of this._$AV)n!==void 0&&(n.strings===void 0?n._$AI(e[t]):(n._$AI(e,n,t),t+=n.strings.length-2)),t++}},Ce=class e{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,n,r){this.type=2,this._$AH=j,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=n,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=N(this,e,t),ce(e)?e===j||e==null||e===``?(this._$AH!==j&&this._$AR(),this._$AH=j):e!==this._$AH&&e!==A&&this._(e):e._$litType$===void 0?e.nodeType===void 0?ue(e)?this.k(e):this._(e):this.T(e):this.$(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==j&&ce(this._$AH)?this._$AA.nextSibling.data=e:this.T(D.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:n}=e,r=typeof n==`number`?this._$AC(e):(n.el===void 0&&(n.el=xe.createElement(ye(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===r)this._$AH.p(t);else{let e=new Se(r,this),n=e.u(this.options);e.p(t),this.T(n),this._$AH=e}}_$AC(e){let t=ve.get(e.strings);return t===void 0&&ve.set(e.strings,t=new xe(e)),t}k(t){le(this._$AH)||(this._$AH=[],this._$AR());let n=this._$AH,r,i=0;for(let a of t)i===n.length?n.push(r=new e(this.O(se()),this.O(se()),this,this.options)):r=n[i],r._$AI(a),i++;i<n.length&&(this._$AR(r&&r._$AB.nextSibling,i),n.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let t=te(e).nextSibling;te(e).remove(),e=t}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},we=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,n,r,i){this.type=1,this._$AH=j,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=i,n.length>2||n[0]!==``||n[1]!==``?(this._$AH=Array(n.length-1).fill(/* @__PURE__ */ new String),this.strings=n):this._$AH=j}_$AI(e,t=this,n,r){let i=this.strings,a=!1;if(i===void 0)e=N(this,e,t,0),a=!ce(e)||e!==this._$AH&&e!==A,a&&(this._$AH=e);else{let r=e,o,s;for(e=i[0],o=0;o<i.length-1;o++)s=N(this,r[n+o],t,o),s===A&&(s=this._$AH[o]),a||=!ce(s)||s!==this._$AH[o],s===j?e=j:e!==j&&(e+=(s??``)+i[o+1]),this._$AH[o]=s}a&&!r&&this.j(e)}j(e){e===j?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??``)}},Te=class extends we{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===j?void 0:e}},Ee=class extends we{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==j)}},De=class extends we{constructor(e,t,n,r,i){super(e,t,n,r,i),this.type=5}_$AI(e,t=this){if((e=N(this,e,t,0)??j)===A)return;let n=this._$AH,r=e===j&&n!==j||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,i=e!==j&&(n===j||r);r&&this.element.removeEventListener(this.name,this,n),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH==`function`?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Oe=class{constructor(e,t,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){N(this,e)}};const ke=ee.litHtmlPolyfillSupport;ke?.(xe,Ce),(ee.litHtmlVersions??=[]).push(`3.3.3`);const Ae=(e,t,n)=>{let r=n?.renderBefore??t,i=r._$litPart$;if(i===void 0){let e=n?.renderBefore??null;r._$litPart$=i=new Ce(t.insertBefore(se(),e),e,void 0,n??{})}return i._$AI(e),i},je=globalThis
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
;var Me=class extends T{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Ae(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return A}};Me._$litElement$=!0,Me.finalized=!0,je.litElementHydrateSupport?.({LitElement:Me});const Ne=je.litElementPolyfillSupport;Ne?.({LitElement:Me}),(je.litElementVersions??=[]).push(`4.2.2`);
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
const Pe=e=>(t,n)=>{n===void 0?customElements.define(e,t):n.addInitializer(()=>{customElements.define(e,t)})},Fe={attribute:!0,type:String,converter:S,reflect:!1,hasChanged:C},Ie=(e=Fe,t,n)=>{
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
let{kind:r,metadata:i}=n,a=globalThis.litPropertyMetadata.get(i);if(a===void 0&&globalThis.litPropertyMetadata.set(i,a=/* @__PURE__ */ new Map),r===`setter`&&((e=Object.create(e)).wrapped=!0),a.set(n.name,e),r===`accessor`){let{name:r}=n;return{set(n){let i=t.get.call(this);t.set.call(this,n),this.requestUpdate(r,i,e,!0,n)},init(t){return t!==void 0&&this.C(r,void 0,e,t),t}}}if(r===`setter`){let{name:r}=n;return function(n){let i=this[r];t.call(this,n),this.requestUpdate(r,i,e,!0,n)}}throw Error(`Unsupported decorator location: `+r)};function Le(e){return(t,n)=>typeof n==`object`?Ie(e,t,n):((e,t,n)=>{let r=t.hasOwnProperty(n);return t.constructor.createProperty(n,e),r?Object.getOwnPropertyDescriptor(t,n):void 0})(e,t,n)}
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/function P(e){return Le({...e,state:!0,attribute:!1})}
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
const Re=(e,t,n)=>(n.configurable=!0,n.enumerable=!0,Reflect.decorate&&typeof t!=`object`&&Object.defineProperty(e,t,n),n);
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/function ze(e,t){return(n,r,i)=>{let a=t=>t.renderRoot?.querySelector(e)??null;if(t){let{get:e,set:t}=typeof r==`object`?n:i??(()=>{let e=Symbol();return{get(){return this[e]},set(t){this[e]=t}}})();return Re(n,r,{get(){let n=e.call(this);return n===void 0&&(n=a(this),(n!==null||this.hasUpdated)&&t.call(this,n)),n}})}return Re(n,r,{get(){return a(this)}})}}
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
const Be={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},Ve=e=>(...t)=>({_$litDirective$:e,values:t});var He=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,n){this._$Ct=e,this._$AM=t,this._$Ci=n}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};
/**
* @license
* Copyright 2018 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/const Ue=Ve(class extends He{constructor(e){if(super(e),e.type!==Be.ATTRIBUTE||e.name!==`class`||e.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return` `+Object.keys(e).filter(t=>e[t]).join(` `)+` `}update(e,[t]){if(this.st===void 0){this.st=/* @__PURE__ */ new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(` `).split(/\s/).filter(e=>e!==``)));for(let e in t)t[e]&&!this.nt?.has(e)&&this.st.add(e);return this.render(t)}let n=e.element.classList;for(let e of this.st)e in t||(n.remove(e),this.st.delete(e));for(let e in t){let r=!!t[e];r===this.st.has(e)||this.nt?.has(e)||(r?(n.add(e),this.st.add(e)):(n.remove(e),this.st.delete(e)))}return A}}),We=[`terrain`,`rivers`,`municipalities`,`districts`,`provinces`,`motorways`,`peaks`,`cities`],Ge=[`AT-1`,`AT-2`,`AT-3`,`AT-4`,`AT-5`,`AT-6`,`AT-7`,`AT-8`,`AT-9`],Ke=[`austria`,...Ge],F={layers:[`terrain`,`rivers`,`provinces`,`cities`],show_labels:!0,show_layer_control:!0,view:`austria`,show_location:!1,location:`home`},qe=[`home`,`device`],Je=/^[a-z_]+\.[a-z0-9_]+$/,Ye=e=>e==null||e===``,Xe=e=>We.filter(t=>e.includes(t));function Ze(e){if(Ye(e))return[...F.layers];let t=We;if(!Array.isArray(e)||e.some(e=>typeof e!=`string`||!t.includes(e)))throw Error(`"layers" must be a list of: ${We.join(`, `)}.`);return Xe(e)}function Qe(e,t){let n=e[t];if(Ye(n))return F[t];if(typeof n!=`boolean`)throw Error(`"${t}" must be true or false.`);return n}function $e(e){if(Ye(e))return F.view;if(typeof e==`string`&&Ke.includes(e))return e;throw Error(`"view" must be one of: ${Ke.join(`, `)}.`)}function et(e){if(Ye(e))return F.location;if(typeof e==`string`&&(qe.includes(e)||Je.test(e)))return e;throw Error(`"location" must be home, device or an entity id such as person.anna.`)}function tt(e){if(e==null)return``;if(typeof e!=`string`)throw Error(`"title" must be text.`);return e.trim()}function nt(e){if(!e||typeof e!=`object`||Array.isArray(e))throw Error(`The card configuration must be a mapping of options.`);let t=e,n={title:tt(t.title),layers:Ze(t.layers),show_labels:Qe(t,`show_labels`),show_layer_control:Qe(t,`show_layer_control`),view:$e(t.view),show_location:Qe(t,`show_location`),location:et(t.location)},r={};for(let e of Object.keys(t))r[e]=e in n?n[e]:t[e];for(let[e,t]of Object.entries(n))e in r||(r[e]=t);return r}const rt=(e,t)=>Array.isArray(e)&&Xe(e).join()===Xe(t).join()&&e.length===t.length;function it(e){let t={};for(let[n,r]of Object.entries(e))if(!Ye(r)){if(n===`layers`){if(rt(r,F.layers))continue;t[n]=Array.isArray(r)?Xe(r):r}else n in F&&F[n]===r||(t[n]=r)}let{type:n,...r}=t;return n===void 0?r:{type:n,...r}}const at=`0.1.0`,I=`austria-map-card`,ot=[...qe,`entity`];function st(e,t,n={shown:!1,entity:!1}){return[{name:`title`,selector:{text:{}}},{name:`view`,selector:{select:{mode:`dropdown`,options:Ke.map(t=>({value:t,label:e(`view_${t}`)}))}}},{name:`layers`,selector:{select:{mode:`list`,multiple:!0,options:We.map(e=>({value:e,label:t(e)}))}}},{name:`show_labels`,selector:{boolean:{}}},{name:`show_layer_control`,selector:{boolean:{}}},{name:`show_location`,selector:{boolean:{}}},...n.shown?[{name:`location`,selector:{select:{mode:`dropdown`,options:ot.map(t=>({value:t,label:e(`location_mode_${t}`)}))}}}]:[],...n.shown&&n.entity?[{name:`location_entity`,selector:{entity:{filter:[{domain:`person`},{domain:`device_tracker`}]}}}]:[]]}var ct=/* @__PURE__ */ t({card:()=>lt,controls:()=>ut,default:()=>gt,editor:()=>ht,facts:()=>mt,kinds:()=>pt,layer_notes:()=>ft,layers:()=>dt}),lt={map_label:`Map of Austria`,map_help:`Arrow keys move the map. Plus and minus zoom. 0 resets the view. Enter reads out what is at the centre.`,loading:`Loading map…`,zoom_hint:`Hold Ctrl or ⌘ and scroll to zoom.`,info_label:`Selected place`,info_idle:`Select a spot on the map to see what is there.`,nothing_here:`Nothing to show here. Move the map or switch on a layer.`,load_failed:`The map data did not load. Check your connection.`,retry:`Try again`,outdated:`The card was updated. Reload the page to show the map.`,reload:`Reload page`,credit:`Data: {holders}`,map_help_tilt:`Shift and the arrow keys tilt and turn the map.`,loading_relief:`Loading terrain…`},ut={group:`Map controls`,layers:`Layers`,zoom_in:`Zoom in`,zoom_out:`Zoom out`,reset:`Reset view`,zoom_here:`Zoom here`,clear:`Clear selection`,my_location:`Show your location`,tilt:`3D view`,north:`Face north`},dt={terrain:`Terrain`,rivers:`Rivers`,provinces:`Provinces`,districts:`Districts`,municipalities:`Municipalities`,cities:`Towns and cities`,peaks:`Peaks`,motorways:`Motorways`},ft={zoom:`Appears when you zoom in`,loading:`Loading…`,failed:`Did not load`},pt={province:`Province`,district:`District`,municipality:`Municipality`,town_0:`City`,town_1:`Market town`,town_2:`Village`,river:`River`,stream:`Stream`,peak:`Peak`,motorway:`Motorway`,expressway:`Expressway`},mt={population:`Population`,municipality_population:`Population of the municipality`,stream_order:`Stream order`,source:`{holder}, as of {stand}`,height:`Height`},ht={title:`Title`,view:`Opening view`,view_austria:`All of Austria`,"view_AT-1":`Burgenland`,"view_AT-2":`Carinthia`,"view_AT-3":`Lower Austria`,"view_AT-4":`Upper Austria`,"view_AT-5":`Salzburg`,"view_AT-6":`Styria`,"view_AT-7":`Tyrol`,"view_AT-8":`Vorarlberg`,"view_AT-9":`Vienna`,layers:`Layers shown at start`,layers_helper:`You can still switch layers on the map. That choice lasts until the page reloads.`,show_labels:`Show names on the map`,show_layer_control:`Show the layer button`,show_layer_control_helper:`Turn this off to lock the layers, for example on a wall display.`,show_location:`Mark your location`,show_location_helper:`Puts a pin on the map. The position stays in your browser.`,location:`Pin shows`,location_mode_home:`Your home, from the Home Assistant settings`,location_mode_device:`This device`,location_mode_entity:`A person or tracker`,location_helper:`“This device” needs HTTPS and your permission. Without them, the pin marks your home.`,location_entity:`Person or tracker`},gt={card:lt,controls:ut,layers:dt,layer_notes:ft,kinds:pt,facts:mt,editor:ht},_t=/* @__PURE__ */ t({card:()=>vt,controls:()=>yt,default:()=>Tt,editor:()=>wt,facts:()=>Ct,kinds:()=>St,layer_notes:()=>xt,layers:()=>bt}),vt={map_label:`Karte von Österreich`,map_help:`Pfeiltasten verschieben die Karte. Plus und Minus zoomen. 0 setzt die Ansicht zurück. Die Eingabetaste liest vor, was in der Mitte liegt.`,loading:`Karte lädt …`,zoom_hint:`Halte Strg oder ⌘ gedrückt und scrolle, um zu zoomen.`,info_label:`Ausgewählter Ort`,info_idle:`Wähle eine Stelle auf der Karte, um zu sehen, was dort ist.`,nothing_here:`Hier gibt es nichts anzuzeigen. Verschiebe die Karte oder schalte eine Ebene ein.`,load_failed:`Die Kartendaten wurden nicht geladen. Prüfe deine Verbindung.`,retry:`Erneut versuchen`,outdated:`Die Karte wurde aktualisiert. Lade die Seite neu, um sie anzuzeigen.`,reload:`Seite neu laden`,credit:`Daten: {holders}`,map_help_tilt:`Umschalt und die Pfeiltasten neigen und drehen die Karte.`,loading_relief:`Gelände wird geladen…`},yt={group:`Kartensteuerung`,layers:`Ebenen`,zoom_in:`Hineinzoomen`,zoom_out:`Herauszoomen`,reset:`Ansicht zurücksetzen`,zoom_here:`Hierher zoomen`,clear:`Auswahl aufheben`,my_location:`Deinen Standort zeigen`,tilt:`3D-Ansicht`,north:`Nach Norden ausrichten`},bt={terrain:`Gelände`,rivers:`Flüsse`,provinces:`Bundesländer`,districts:`Bezirke`,municipalities:`Gemeinden`,cities:`Städte und Orte`,peaks:`Gipfel`,motorways:`Autobahnen`},xt={zoom:`Erscheint, wenn du hineinzoomst`,loading:`Lädt …`,failed:`Nicht geladen`},St={province:`Bundesland`,district:`Bezirk`,municipality:`Gemeinde`,town_0:`Stadt`,town_1:`Markt`,town_2:`Dorf`,river:`Fluss`,stream:`Bach`,peak:`Gipfel`,motorway:`Autobahn`,expressway:`Schnellstraße`},Ct={population:`Einwohner`,municipality_population:`Einwohner der Gemeinde`,stream_order:`Flussordnungszahl`,source:`{holder}, Stand {stand}`,height:`Höhe`},wt={title:`Titel`,view:`Ansicht beim Öffnen`,view_austria:`Ganz Österreich`,"view_AT-1":`Burgenland`,"view_AT-2":`Kärnten`,"view_AT-3":`Niederösterreich`,"view_AT-4":`Oberösterreich`,"view_AT-5":`Salzburg`,"view_AT-6":`Steiermark`,"view_AT-7":`Tirol`,"view_AT-8":`Vorarlberg`,"view_AT-9":`Wien`,layers:`Ebenen beim Öffnen`,layers_helper:`Auf der Karte kannst du Ebenen weiterhin ein- und ausschalten. Diese Auswahl gilt, bis die Seite neu lädt.`,show_labels:`Namen auf der Karte anzeigen`,show_layer_control:`Ebenen-Schaltfläche anzeigen`,show_layer_control_helper:`Schalte das aus, um die Ebenen zu sperren, zum Beispiel auf einem Wanddisplay.`,show_location:`Deinen Standort markieren`,show_location_helper:`Setzt eine Stecknadel auf die Karte. Die Position bleibt in deinem Browser.`,location:`Stecknadel zeigt`,location_mode_home:`Dein Zuhause, aus den Home-Assistant-Einstellungen`,location_mode_device:`Dieses Gerät`,location_mode_entity:`Eine Person oder einen Tracker`,location_helper:`„Dieses Gerät“ braucht HTTPS und deine Erlaubnis. Ohne beides markiert die Stecknadel dein Zuhause.`,location_entity:`Person oder Tracker`},Tt={card:vt,controls:yt,layers:bt,layer_notes:xt,kinds:St,facts:Ct,editor:wt};const Et=Object.fromEntries([{code:`en`,nativeName:`English`,dict:ct},{code:`de`,nativeName:`Deutsch`,dict:_t}].map(e=>[e.code,e.dict]));function Dt(e,t){let n=e.split(`.`).reduce((e,t)=>{if(e&&typeof e==`object`&&t in e)return e[t]},t);return typeof n==`string`?n:void 0}function Ot(e,t=void 0,n){let r=(t??`en`).toLowerCase().split(/[-_]/)[0]??`en`,i=Et[r]??Et.en??{},a=Et.en??{},o=Dt(e,i);if(o===void 0&&(o=Dt(e,a)),o===void 0&&(o=e),n)for(let[e,t]of Object.entries(n)){let n=String(t);o=o.replace(RegExp(`\\{${e}\\}`,`g`),()=>n)}return o}function kt(e){return e?.locale?.language??e?.language??(typeof navigator<`u`?navigator.language:`en`)}function L(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a}const At=e=>typeof e==`string`&&!qe.includes(e);let jt=class extends Me{constructor(...e){super(...e),this._config={type:`custom:${I}`},this._entityMode=!1,this._t=e=>Ot(`editor.${e}`,kt(this.hass)),this._layerName=e=>Ot(`layers.${e}`,kt(this.hass)),this._label=({name:e})=>this._t(e),this._helper=({name:e})=>{let t=this._t(`${e}_helper`);return t===`editor.${e}_helper`?void 0:t}}static{this.styles=c`
    :host {
      display: block;
    }
  `}setConfig(e){this._config={...e}}_shown(){let e;try{e=nt(this._config)}catch{e=this._config}let t=e.location;return!this._entityMode&&!At(t)?e:{...e,location:`entity`,location_entity:At(t)?t:void 0}}_onChange(e){e.stopPropagation();let{location:t,location_entity:n,...r}=e.detail.value,i=t;t===`entity`?(this._entityMode=!0,i=typeof n==`string`&&n!==``?n:void 0):t!==void 0&&(this._entityMode=!1);let a=it({...this._config,...r,location:i});this._config=a,this.dispatchEvent(new CustomEvent(`config-changed`,{detail:{config:a},bubbles:!0,composed:!0}))}render(){let e=this._shown(),t={shown:e.show_location===!0,entity:e.location===`entity`};return k`
      <ha-form
        .hass=${this.hass}
        .data=${e}
        .schema=${st(this._t,this._layerName,t)}
        .computeLabel=${this._label}
        .computeHelper=${this._helper}
        @value-changed=${this._onChange}
      ></ha-form>
    `}};L([Le({attribute:!1})],jt.prototype,`hass`,void 0),L([P()],jt.prototype,`_config`,void 0),L([P()],jt.prototype,`_entityMode`,void 0),jt=L([Pe(`${I}-editor`)],jt);function Mt(e,t,n){return t.map(t=>({label:t.label,value:t.values[n]??0,format:t.format,source:e.source(t.source)})).filter(e=>e.value!==0)}const Nt=(e,t,n,r,i)=>({name:t.names[n]??``,kind:r,parents:i,facts:Mt(e,t.facts,n)});function Pt(e,t){let n=e.overview?.provinces,r=e.detail;switch(t.kind){case`province`:return n===void 0?null:Nt(e,n,t.row,`kinds.province`,[]);case`district`:{if(r===void 0||n===void 0)return null;let i=r.districts.parent?.[t.row]??-1;return Nt(e,r.districts,t.row,`kinds.district`,[n.names[i]??``])}case`municipality`:{if(r===void 0||n===void 0)return null;let i=r.municipalities.parent?.[t.row]??-1;return Nt(e,r.municipalities,t.row,`kinds.municipality`,[r.districts.names[i]??``,n.names[r.provinceOf[t.row]??-1]??``])}case`city`:{let i=e.places;if(i===void 0)return null;let a=i.names[t.row]??``,o=[],s=i.municipality[t.row]??-1;if(r!==void 0&&n!==void 0&&s>=0){let e=r.municipalities.parent?.[s]??-1;o.push(r.municipalities.names[s]??``,r.districts.names[e]??``,n.names[r.provinceOf[s]??-1]??``)}return{name:a,kind:`kinds.town_${i.kind[t.row]??2}`,parents:o,facts:Mt(e,i.facts,t.row)}}case`peak`:{let i=e.peaks;if(i===void 0)return null;let a=i.at[t.row*2],o=i.at[t.row*2+1],s=[],c=e.municipalityIndex?.locate(a,o)??-1;if(r!==void 0&&n!==void 0&&c>=0){let e=r.municipalities.parent?.[c]??-1;s.push(r.municipalities.names[c]??``,r.districts.names[e]??``,n.names[r.provinceOf[c]??-1]??``)}else if(n!==void 0&&e.overview!==void 0){let t=e.overview.index.locate(a,o);t>=0&&s.push(n.names[t]??``)}return{name:i.names[t.row]??``,kind:`kinds.peak`,parents:s,facts:Mt(e,i.facts,t.row)}}case`motorway`:{let n=e.motorways,r=n?.refs.indexOf(t.ref)??-1;if(n===void 0||r<0)return null;let i=n.names[r]??``;return{name:i===``?t.ref:`${t.ref} · ${i}`,kind:t.ref.startsWith(`S`)?`kinds.expressway`:`kinds.motorway`,parents:[],facts:[]}}case`river`:{let n=e.sources().find(e=>e.id===`bmluk-ggn`);return{name:t.name,kind:t.order>=5?`kinds.river`:`kinds.stream`,parents:[],facts:[{label:`facts.stream_order`,value:t.order,format:`integer`,source:n}]}}}}const Ft=[`base`,`borders`,`gemeinden`,`terrain-detail`,`rivers-detail`,`places`,`relief`,`peaks`,`motorways`],It=e=>`austria-map-data-${e}.js`,Lt=e=>e===33?0:e<92?e-34:e-35;function R(e){let t=0;for(let n=0;n<e.length;n+=1)Lt(e.charCodeAt(n))<46&&(t+=1);let n=new Int32Array(t),r=0,i=0,a=1;for(let t=0;t<e.length;t+=1){let o=Lt(e.charCodeAt(t));o>=46?(i+=(o-46)*a,a*=46):(i+=o*a,n[r]=i%2==0?i/2:-(i+1)/2,r+=1,i=0,a=1)}return n}function z(e){let t=R(e.d),n=new Uint32Array(e.n+1),r=0,i=0;for(let a=0;a<e.n;a+=1){let e=t[i];n[a]=r,r+=e,i+=1+e*2}if(n[e.n]=r,i!==t.length)throw Error(`packed lines are damaged`);let a=new Float32Array(r*2),o=0,s=0,c=0;i=0;for(let n=0;n<e.n;n+=1){let n=t[i];i+=1;let r=o,l=s;for(let u=0;u<n;u+=1)r+=t[i],l+=t[i+1],i+=2,u===0&&(o=r,s=l),a[c]=r*e.q,a[c+1]=l*e.q,c+=2}return{xy:a,start:n,count:e.n,closed:e.closed}}function Rt(e,t){let n=new Float32Array(e.xy.length+t.xy.length);n.set(e.xy,0),n.set(t.xy,e.xy.length);let r=new Uint32Array(e.count+t.count+1);r.set(e.start.subarray(0,e.count),0);let i=e.xy.length/2;for(let n=0;n<=t.count;n+=1)r[e.count+n]=t.start[n]+i;return{xy:n,start:r,count:e.count+t.count,closed:e.closed}}function zt(e){let t=new Float32Array(e.count*4);for(let n=0;n<e.count;n+=1){let r=1/0,i=1/0,a=-1/0,o=-1/0;for(let t=e.start[n];t<e.start[n+1];t+=1){let n=e.xy[t*2],s=e.xy[t*2+1];n<r&&(r=n),n>a&&(a=n),s<i&&(i=s),s>o&&(o=s)}t.set([r,i,a,o],n*4)}return t}function Bt(e,t){let n=new Int32Array(e.length);for(let r=0;r<e.length;r+=1){let i=e[r];n[r]=i<0?-1:t[i]}return n}var Vt=class{constructor(e,t,n,r){if(t.length!==e.count||n.length!==e.count)throw Error(`an arc set needs one pair of sides per line`);this.lines=e,this.groups=r,this.arcBoxes=zt(e),this.members=Array.from({length:r},()=>[]),this.groupBoxes=new Float32Array(r*4);for(let e=0;e<r;e+=1)this.groupBoxes.set([1/0,1/0,-1/0,-1/0],e*4);for(let r=0;r<e.count;r+=1){let e=t[r],i=n[r];if(e!==i)for(let t of[e,i]){if(t<0)continue;this.members[t].push(r);let e=t*4,n=this.groupBoxes;n[e]=Math.min(n[e],this.arcBoxes[r*4]),n[e+1]=Math.min(n[e+1],this.arcBoxes[r*4+1]),n[e+2]=Math.max(n[e+2],this.arcBoxes[r*4+2]),n[e+3]=Math.max(n[e+3],this.arcBoxes[r*4+3])}}}arcsOf(e){return this.members[e]??[]}box(e){let t=e*4,n=this.groupBoxes;return[n[t],n[t+1],n[t+2],n[t+3]]}contains(e,t,n){let r=e*4,i=this.groupBoxes;if(!(t>=i[r]&&t<=i[r+2]&&n>=i[r+1]&&n<=i[r+3]))return!1;let{xy:a,start:o}=this.lines,s=!1;for(let r of this.members[e]){if(this.arcBoxes[r*4+2]<t||this.arcBoxes[r*4+1]>n||this.arcBoxes[r*4+3]<n)continue;let e=o[r+1]-1;for(let i=o[r];i<e;i+=1){let e=a[i*2+1],r=a[i*2+3];if(e>n==r>n)continue;let o=a[i*2];t<(a[i*2+2]-o)*(n-e)/(r-e)+o&&(s=!s)}}return s}locate(e,t){for(let n=0;n<this.groups;n+=1)if(this.contains(n,e,t))return n;return-1}rings(e){return Ht(this.lines,this.members[e]??[])}};function Ht(e,t){let{xy:n,start:r}=e,i=e=>`${n[e*2]},${n[e*2+1]}`,a=e=>r[e],o=e=>r[e+1]-1,s=/* @__PURE__ */ new Map;for(let e of t)for(let t of[i(a(e)),i(o(e))]){let n=s.get(t);n===void 0?s.set(t,[e]):n.push(e)}let c=/* @__PURE__ */ new Set,l=[];for(let e of t){if(c.has(e))continue;let t=[],r=i(a(e)),u=e,d=!0,f=!1;for(;;){c.add(u),t.push({arc:u,forward:d});let e=i(d?o(u):a(u));if(e===r){f=!0;break}let n=(s.get(e)??[]).find(e=>!c.has(e));if(n===void 0)break;d=i(a(n))===e,u=n}if(!f)continue;let p=1;for(let e of t)p+=o(e.arc)-a(e.arc);let m=new Float32Array(p*2),h=0;for(let e of t){let t=a(e.arc),r=o(e.arc);for(let i=0;i<r-t;i+=1){let a=e.forward?t+i:r-i;m[h]=n[a*2],m[h+1]=n[a*2+1],h+=2}}m[h]=m[0],m[h+1]=m[1],l.push(m)}return l}function Ut(e){let t=z(e.lines);return{refs:e.refs,names:e.names,lines:t,route:R(e.route),boxes:zt(t)}}function Wt(e){let t=qt(e.facts);return{count:e.names.length,names:e.names,at:z(e.at).xy,isolation:R(e.isolation),major:R(e.major),height:t.find(e=>e.key===`height`)?.values??new Int32Array(e.names.length),facts:t}}function Gt(e){let t=R(e.d);if(t.length!==e.columns*e.rows)throw Error(`the relief grid is damaged`);let n=new Float32Array(t.length),r=0;for(let i=0;i<e.rows;i+=1){let a=0;for(let o=0;o<e.columns;o+=1){let s=i*e.columns+o;a+=t[s];let c=a*e.step;n[s]=c,c>r&&(r=c)}}return{columns:e.columns,rows:e.rows,metres:n,peak:r}}function Kt(e,t,n){let{columns:r,rows:i,metres:a}=e,o=Math.min(Math.max(t-.5,0),r-1),s=Math.min(Math.max(n-.5,0),i-1),c=Math.floor(o),l=Math.floor(s),u=Math.min(c+1,r-1),d=Math.min(l+1,i-1),f=o-c,p=s-l,m=(e,t)=>a[t*r+e],h=m(c,l)*(1-f)+m(u,l)*f,g=m(c,d)*(1-f)+m(u,d)*f;return h*(1-p)+g*p}const qt=e=>e.map(e=>({...e,values:R(e.values)}));function Jt(e){return{count:e.ids.length,ids:e.ids,names:e.names,parent:e.parent===void 0?null:R(e.parent),at:z(e.at).xy,facts:qt(e.facts)}}const Yt=e=>({lines:z(e.lines),a:R(e.a),b:R(e.b)}),Xt=e=>({levels:e.levels,bands:e.bands.map(z)});function Zt(e){let t=z(e.lines),n=z(e.labels);return{names:e.names,lines:t,name:R(e.name),order:R(e.order),boxes:zt(t),labels:n,labelName:R(e.labelName),labelOrder:R(e.labelOrder),labelLevel:R(e.labelLevel),labelBoxes:zt(n)}}function Qt(e){return{count:e.names.length,names:e.names,at:z(e.at).xy,kind:R(e.kind),capital:R(e.capital),municipality:R(e.municipality),rank:R(e.rank),facts:qt(e.facts)}}const $t=e=>{let t=[];for(let n=0;n<e.lines.count;n+=1)e.a[n]<0&&t.push(n);return Ht(e.lines,t)};var en=class{constructor(){this.revision=0,this.loaded=/* @__PURE__ */ new Map}has(e){return this.loaded.has(e)}sources(){let e=/* @__PURE__ */ new Map;for(let t of Ft)for(let n of this.loaded.get(t)??[])e.has(n.id)||e.set(n.id,n);return[...e.values()]}source(e){return this.sources().find(t=>t.id===e)}add(e){if(e.format!==1)throw Error(`map data "${e.id}" is in format ${e.format}, this card reads 1`);if(!this.loaded.has(e.id)){switch(e.id){case`base`:{let t=Jt(e.provinces),n=Yt(e.arcs);this.overview={provinces:t,arcs:n,index:new Vt(n.lines,n.a,n.b,t.count),country:$t(n),terrain:Xt(e.terrain),rivers:Zt(e.rivers)};break}case`borders`:{let t=Jt(e.districts),n=Jt(e.municipalities),r=Yt(e.arcs),i=n.parent,a=Bt(i,t.parent),o=a.reduce((e,t)=>Math.max(e,t),-1)+1,s=new Uint8Array(r.lines.count);for(let e=0;e<s.length;e+=1){let t=r.a[e],n=r.b[e];s[e]=t<0?0:a[t]===a[n]?2:1}this.detail={districts:t,municipalities:n,arcs:r,level:s,provinceOf:a,districtIndex:new Vt(r.lines,Bt(r.a,i),Bt(r.b,i),t.count),provinceIndex:new Vt(r.lines,Bt(r.a,a),Bt(r.b,a),o),country:$t(r)},this.municipal=void 0;break}case`gemeinden`:this.municipalArcs=Yt(e.arcs),this.municipal=void 0;break;case`terrain-detail`:this.terrainDetail=Xt(e.terrain);break;case`rivers-detail`:this.riversDetail=Zt(e.rivers);break;case`places`:this.places=Qt(e.places);break;case`relief`:this.relief=Gt(e.relief);break;case`peaks`:this.peaks=Wt(e.peaks);break;case`motorways`:this.motorways=Ut(e.motorways)}this.loaded.set(e.id,e.sources),this.revision+=1}}get municipalityIndex(){if(this.municipal===void 0&&this.detail!==void 0&&this.municipalArcs!==void 0){let e=this.detail.arcs,t=this.municipalArcs;this.municipal=new Vt(Rt(e.lines,t.lines),Int32Array.from([...e.a,...t.a]),Int32Array.from([...e.b,...t.b]),this.detail.municipalities.count)}return this.municipal}};const tn=e=>import(
/* @vite-ignore */
e);var nn=class{constructor(e,t){this.states=/* @__PURE__ */ new Map,this.attempts=/* @__PURE__ */ new Map,this.listeners=/* @__PURE__ */ new Set,this.store=e,this.base=t.base,this.version=t.version,this.importer=t.importer??tn}state(e){return this.states.get(e)??`idle`}url(e){let t=this.attempts.get(e)??0,n=t>0?`&retry=${t}`:``;return new URL(`${It(e)}?v=${encodeURIComponent(this.version)}${n}`,this.base).href}request(e){for(let t of e)this.state(t)===`idle`&&this.load(t)}retry(){for(let e of Ft)this.state(e)===`failed`&&(this.attempts.set(e,(this.attempts.get(e)??0)+1),this.states.set(e,`idle`),this.load(e))}get failed(){return Ft.filter(e=>this.state(e)===`failed`)}get outdated(){return Ft.some(e=>this.state(e)===`outdated`)}get loading(){return Ft.some(e=>this.state(e)===`loading`)}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}async load(e){this.set(e,`loading`);let t;try{t=await this.importer(this.url(e))}catch(t){console.warn(`[austria-map-card] map data "${e}" did not load`,t),this.set(e,`failed`);return}let n=t?.default;if(n==null||n.format!==1||n.id!==e)console.warn(`[austria-map-card] map data "${e}" is in format ${String(n?.format)}, this card reads 1`),this.set(e,`outdated`);else{try{this.store.add(n)}catch(t){console.error(`[austria-map-card] map data "${e}" could not be read`,t),this.set(e,`outdated`);return}this.set(e,`ready`)}}set(e,t){this.states.set(e,t);for(let e of[...this.listeners])e()}};let rn;function an(e){return rn??=new nn(new en,e),rn}const B=Math.PI/180,on=46*B,sn=49*B,cn=47.5*B,ln=(13+20/60)*B,un=e=>Math.tan(Math.PI/4+e/2),dn=Math.log(Math.cos(on)/Math.cos(sn))/Math.log(un(sn)/un(on)),fn=Math.cos(on)*un(on)**+dn/dn,pn=fn/un(cn)**+dn,V=1e3,mn=10890;function hn(e,t){let n=fn/un(e*B)**+dn,r=dn*(t*B-ln),i=n*Math.sin(r),a=pn-n*Math.cos(r);return[503.3+mn*i,303.6-mn*a]}function H(e){return Math.max(Math.min(e.width/V,e.height/530),1e-6)}function gn(e,t){return e.k/H(t)}function _n(e,t){let n=H(t),r=Math.min(Math.max(e.k,n),n*40),i=1-n/r,a=(e,t,n)=>{let a=n/(2*r)*(1-i),o=t-a;return a>=o?t/2:Math.min(Math.max(e,a),o)};return{x:a(e.x,V,t.width),y:a(e.y,530,t.height),k:r}}function vn(e){return{x:V/2,y:265,k:H(e)}}function yn(e,t,n){let r=Math.max(e[2]-e[0],1e-6),i=Math.max(e[3]-e[1],1e-6),a=Math.min(Math.max(t.width-2*n,1)/r,Math.max(t.height-2*n,1)/i);return _n({x:(e[0]+e[2])/2,y:(e[1]+e[3])/2,k:a},t)}function bn(e,t,n,r){return[(n-e.x)*e.k+t.width/2,(r-e.y)*e.k+t.height/2]}function xn(e,t,n,r){return[(n-t.width/2)/e.k+e.x,(r-t.height/2)/e.k+e.y]}function Sn(e,t){let n=t.width/(2*e.k),r=t.height/(2*e.k);return[e.x-n,e.y-r,e.x+n,e.y+r]}function Cn(e,t,n,r,i){let a=H(t),o=Math.min(Math.max(e.k*i,a),a*40),[s,c]=xn(e,t,n,r);return _n({x:s-(n-t.width/2)/o,y:c-(r-t.height/2)/o,k:o},t)}function wn(e,t,n,r){return _n({x:e.x-n/e.k,y:e.y-r/e.k,k:e.k},t)}function Tn(e,t,n){return _n({...e,k:gn(e,t)*H(n)},n)}const En=(e,t)=>e[0]<=t[2]&&e[2]>=t[0]&&e[1]<=t[3]&&e[3]>=t[1];var Dn=class{constructor(e){this.paths=/* @__PURE__ */ new Map,this.create=e}get(e,t){let n=this.paths.get(e);return n===void 0&&(n=this.create(),t(n),this.paths.set(e,n)),n}get size(){return this.paths.size}};function On(e,t,n){let{xy:r,start:i,closed:a}=t,o=t=>{let n=i[t],o=i[t+1];if(!(o-n<2)){e.moveTo(r[n*2],r[n*2+1]);for(let t=n+1;t<o;t+=1)e.lineTo(r[t*2],r[t*2+1]);a&&e.closePath()}};if(n===void 0)for(let e=0;e<t.count;e+=1)o(e);else for(let e of n)o(e)}function kn(e,t){let{xy:n,start:r}=t;for(let i=0;i<t.count;i+=1){let t=r[i],a=r[i+1]-t;if(a<3)continue;let o=e=>n[(t+e%a)*2],s=e=>n[(t+e%a)*2+1];e.moveTo((o(0)+o(1))/2,(s(0)+s(1))/2);for(let t=1;t<=a;t+=1)e.quadraticCurveTo(o(t),s(t),(o(t)+o(t+1))/2,(s(t)+s(t+1))/2);e.closePath()}}function An(e,t){for(let n of t)if(!(n.length<6)){e.moveTo(n[0],n[1]);for(let t=2;t<n.length;t+=2)e.lineTo(n[t],n[t+1]);e.closePath()}}var jn=class{constructor(e,t,n,r=64){this.tiles=/* @__PURE__ */ new Map,this.lines=e;for(let i=0;i<e.count;i+=1){let e=t[i*4],a=t[i*4+1],o=t[i*4+2],s=t[i*4+3],c=Math.floor((a+s)/2/r)*4096+Math.floor((e+o)/2/r),l=this.tiles.get(c);l===void 0?(l={box:[e,a,o,s],byClass:/* @__PURE__ */ new Map},this.tiles.set(c,l)):l.box=[Math.min(l.box[0],e),Math.min(l.box[1],a),Math.max(l.box[2],o),Math.max(l.box[3],s)];let u=n===null?0:n[i],d=l.byClass.get(u);d===void 0?l.byClass.set(u,[i]):d.push(i)}}visit(e,t,n){for(let[r,i]of this.tiles){if(!En(i.box,e))continue;let a=i.byClass.get(t);a!==void 0&&n(r,a)}}get tileCount(){return this.tiles.size}};const U={fineBorders:2.2,terrainDetail:2.2,riversDetail:2,streams:5,municipalities:2.5};function W(e,t){return e*Math.min(1.7,Math.max(1,1+.18*Math.log2(t)))}const Mn=[1.5,1.1,.8,.5],Nn=/* @__PURE__ */ new WeakMap;function Pn(e,t){let n=Nn.get(e.lines);return n===void 0&&(n=new jn(e.lines,zt(e.lines),t),Nn.set(e.lines,n)),n}function Fn(e,t){let{ctx:n,store:r,palette:i,shapes:a,scale:o,box:s,fine:c}=e,l,u=``,d=t;if(t===3){if(r.municipalArcs===void 0)return;l=Pn(r.municipalArcs,null),u=`municipal`,d=0}else if(c&&r.detail!==void 0)l=Pn(r.detail.arcs,r.detail.level),u=`fine`;else if(r.overview!==void 0&&t<2){let{arcs:e}=r.overview;l=Pn(e,Uint8Array.from(e.a,e=>e<0?0:1)),u=`coarse`}if(l===void 0)return;let f=l.lines;n.strokeStyle=[i.outline,i.province,i.district,i.municipality][t],n.lineWidth=W(Mn[t],o)/o,n.lineCap=`round`,n.lineJoin=`round`,l.visit(s,d,(e,r)=>{n.stroke(a.get(`borders:${u}:${t}:${e}`,e=>On(e,f,r)))})}const In={id:`provinces`,icon:`mdi:map-outline`,minScale:0,clipped:!1,chunks:()=>[],draw:e=>Fn(e,1)},Ln={id:`districts`,icon:`mdi:vector-polygon`,minScale:0,clipped:!1,chunks:()=>[`borders`],draw:e=>Fn(e,2)},Rn={id:`municipalities`,icon:`mdi:vector-square`,minScale:U.municipalities,clipped:!1,chunks:e=>e>=U.municipalities?[`borders`,`gemeinden`]:[],draw:e=>Fn(e,3)},zn=3.6;function Bn(e){let{ctx:t,store:n,palette:r,shapes:i,scale:a}=e,o=n.motorways;if(o===void 0)return;let s=i.get(`motorways`,e=>On(e,o.lines));t.lineCap=`round`,t.lineJoin=`round`,t.strokeStyle=r.motorwayCasing,t.lineWidth=W(zn,a)/a,t.stroke(s),t.strokeStyle=r.motorway,t.lineWidth=W(2,a)/a,t.stroke(s)}function Vn(e,t){let n=e.motorways,r=n?.refs.indexOf(t)??-1;if(n===void 0||r<0)return;let i=[];for(let e=0;e<n.lines.count;e+=1)n.route[e]===r&&i.push(e);return{lines:n.lines,which:i}}function Hn(e,t){let n=Vn(e,t),r=e.motorways?.boxes;if(n===void 0||r===void 0||n.which.length===0)return;let i=[1/0,1/0,-1/0,-1/0];for(let e of n.which)i=[Math.min(i[0],r[e*4]),Math.min(i[1],r[e*4+1]),Math.max(i[2],r[e*4+2]),Math.max(i[3],r[e*4+3])];return i}function Un(e,t,n,r){let i=e.motorways;if(i===void 0)return;let{xy:a,start:o}=i.lines,s=r,c;for(let e=0;e<i.lines.count;e+=1){let l=i.boxes;if(!(t<l[e*4]-r||t>l[e*4+2]+r)&&!(n<l[e*4+1]-r||n>l[e*4+3]+r))for(let r=o[e];r+1<o[e+1];r+=1){let o=a[r*2],l=a[r*2+1],u=a[r*2+2]-o,d=a[r*2+3]-l,f=u*u+d*d,p=f===0?0:Math.max(0,Math.min(1,((t-o)*u+(n-l)*d)/f)),m=Math.hypot(t-(o+p*u),n-(l+p*d));m<s&&(s=m,c=i.refs[i.route[e]])}}return c}const Wn={id:`motorways`,icon:`mdi:highway`,minScale:0,clipped:!1,chunks:()=>[`motorways`],draw:Bn},Gn={id:`peaks`,icon:`mdi:summit`,minScale:0,clipped:!1,chunks:()=>[`peaks`],draw:()=>void 0},Kn={id:`cities`,icon:`mdi:city-variant-outline`,minScale:0,clipped:!1,chunks:()=>[`places`],draw:()=>void 0};function qn(e){return e<.75?4e4:e<1.2?25e3:e<2?12e3:e<3.5?5e3:e<6?2e3:e<10?800:0}function Jn(e,t){let n=e.capital[t],r=e.rank[t];return n===2?0:n===1||r>=1e5?1:r>=2e4?2:r>=5e3?3:4}const Yn={9:2.2,8:1.8,7:1.5,6:1.1,5:.8,4:.6,3:.45};function Xn(e,t){let n=t>=U.riversDetail?e.riversDetail:void 0;if(n!==void 0)return{rivers:n,set:`detail`,minOrder:t>=U.streams?3:4};let r=e.overview?.rivers;return r===void 0?void 0:{rivers:r,set:`overview`,minOrder:5}}const Zn=/* @__PURE__ */ new WeakMap;function Qn(e){let t=Zn.get(e.lines);return t===void 0&&(t=new jn(e.lines,e.boxes,e.order),Zn.set(e.lines,t)),t}function $n(e){let{ctx:t,store:n,palette:r,shapes:i,scale:a,box:o}=e,s=Xn(n,a);if(s===void 0)return;let c=Qn(s.rivers);t.strokeStyle=r.water,t.lineCap=`round`,t.lineJoin=`round`;for(let e=s.minOrder;e<=9;e+=1)t.lineWidth=W(Yn[e]??.45,a)/a,c.visit(o,e,(n,r)=>{t.stroke(i.get(`rivers:${s.set}:${e}:${n}`,e=>On(e,s.rivers.lines,r)))})}function er(e,t,n){let r=Xn(e,t);if(r===void 0)return;let i=r.rivers.names.indexOf(n);if(i<0)return;let a=[];for(let e=0;e<r.rivers.lines.count;e+=1)r.rivers.name[e]===i&&r.rivers.order[e]>=r.minOrder&&a.push(e);return{lines:r.rivers.lines,which:a}}function tr(e,t){let n=e.riversDetail??e.overview?.rivers;if(n===void 0)return;let r=n.names.indexOf(t);if(r<0)return;let i;for(let e=0;e<n.lines.count;e+=1){if(n.name[e]!==r)continue;let t=e*4,a=n.boxes;i=i===void 0?[a[t],a[t+1],a[t+2],a[t+3]]:[Math.min(i[0],a[t]),Math.min(i[1],a[t+1]),Math.max(i[2],a[t+2]),Math.max(i[3],a[t+3])]}return i}function nr(e,t,n,r,i){let a=Xn(e,t);if(a===void 0)return;let{rivers:o,minOrder:s}=a,{xy:c,start:l}=o.lines,u=i,d;for(let e=0;e<o.lines.count;e+=1){let t=o.order[e],a=o.names[o.name[e]];if(t<s||a===``)continue;let f=e*4;if(!(n<o.boxes[f]-i||n>o.boxes[f+2]+i||r<o.boxes[f+1]-i||r>o.boxes[f+3]+i))for(let i=l[e];i+1<l[e+1];i+=1){let e=c[i*2],o=c[i*2+1],s=c[i*2+2]-e,l=c[i*2+3]-o,f=s*s+l*l,p=f===0?0:Math.max(0,Math.min(1,((n-e)*s+(r-o)*l)/f)),m=Math.hypot(n-(e+p*s),r-(o+p*l));m<u&&(u=m,d={name:a,order:t})}}return d}const rr={id:`rivers`,icon:`mdi:waves`,minScale:0,clipped:!1,chunks:e=>e>=U.riversDetail?[`rivers-detail`]:[],draw:$n};function ir(e){let{ctx:t,store:n,palette:r,shapes:i,scale:a}=e,o=a>=U.terrainDetail?n.terrainDetail:void 0,s=o??n.overview?.terrain;if(s===void 0)return;let c=o===void 0?`overview`:`detail`;s.bands.forEach((e,n)=>{t.fillStyle=r.band(s.levels[n]),t.fill(i.get(`terrain:${c}:${n}`,t=>kn(t,e)),`evenodd`)})}const G=[{id:`terrain`,icon:`mdi:image-filter-hdr`,minScale:0,clipped:!0,chunks:e=>e>=U.terrainDetail?[`terrain-detail`]:[],draw:ir},rr,Rn,Ln,In,Wn,Gn,Kn];if(G.map(e=>e.id).join()!==We.join())throw Error(`the layer registry and LAYER_IDS have drifted apart`);function ar(e,t){let n=/* @__PURE__ */ new Set([`base`]);t>=U.fineBorders&&n.add(`borders`);for(let r of G)if(e.has(r.id))for(let e of r.chunks(t))n.add(e);return Ft.filter(e=>n.has(e))}function or(e,t,n){return e.detail===void 0?!1:n>=U.fineBorders||t.has(`districts`)||t.has(`municipalities`)}const sr=e=>typeof e==`number`&&Number.isFinite(e),cr=(e,t)=>sr(e)&&sr(t)&&(e!==0||t!==0)?{latitude:e,longitude:t}:null,lr=e=>cr(e?.config?.latitude,e?.config?.longitude);function ur(e,t,n){if(t===`home`)return lr(e);if(t===`device`)return n??lr(e);let r=e?.states?.[t];return r===void 0?null:cr(r.attributes.latitude,r.attributes.longitude)??(r.state===`home`?lr(e):null)}function dr(e,t,n){let r=ur(e,t,n);return r===null?``:`${r.latitude},${r.longitude}`}const fr={pitch:0,bearing:0},pr=Math.PI/180,mr=65*pr,hr=55*pr,gr=36*pr;function _r(e){return Math.min(3,Math.max(1.6,3/Math.max(e,1)**.4))}const vr=e=>e.pitch<1e-4&&Math.abs(yr(e.bearing))<1e-4;function yr(e){let t=e%(2*Math.PI);return t>Math.PI?t-2*Math.PI:t<=-Math.PI?t+2*Math.PI:t}function br(e,t,n){return{pitch:Math.min(Math.max(e.pitch+t,0),mr),bearing:yr(e.bearing+n)}}const K=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2];function xr(e,t,n,r){return e===void 0?0:Kt(e,t,n)/585*r}var Sr=class{constructor(e,t,n,r){this.size=n,this.scale=e.k,this.stretch=_r(e.k/H(n));let{pitch:i,bearing:a}=t,o=[Math.sin(a),-Math.cos(a)];this.forward=[o[0]*Math.sin(i),o[1]*Math.sin(i),-Math.cos(i)],this.right=[Math.cos(a),Math.sin(a),0],this.down=[-o[0]*Math.cos(i),-o[1]*Math.cos(i),-Math.sin(i)],this.focal=n.height/2/Math.tan(gr/2);let s=this.focal/e.k;this.distance=s;let c=[e.x,e.y,xr(r,e.x,e.y,this.stretch)],l=[c[0]-this.forward[0]*s,c[1]-this.forward[1]*s,c[2]-this.forward[2]*s];l[2]=Math.max(l[2],xr(r,l[0],l[1],this.stretch)+s*.08),this.eye=l,this.near=Math.max(s*.02,.02),this.far=s*6+V*2}matrix(){let{eye:e,forward:t,right:n,down:r,near:i,far:a}=this,o=this.focal/(this.size.width/2),s=this.focal/(this.size.height/2),c=(a+i)/(a-i),l=-2*a*i/(a-i),u=[[o*n[0],o*n[1],o*n[2],-o*K(n,e)],[-s*r[0],-s*r[1],-s*r[2],s*K(r,e)],[c*t[0],c*t[1],c*t[2],-c*K(t,e)+l],[t[0],t[1],t[2],-K(t,e)]],d=/* @__PURE__ */ new Float32Array(16);for(let e=0;e<4;e+=1)for(let t=0;t<4;t+=1)d[t*4+e]=u[e][t];return d}projectGround(e,t,n){return this.project(t,n,xr(e,t,n,this.stretch))}project(e,t,n){let r=[e-this.eye[0],t-this.eye[1],n-this.eye[2]],i=K(r,this.forward);return i<this.near?null:[this.size.width/2+this.focal*K(r,this.right)/i,this.size.height/2+this.focal*K(r,this.down)/i]}ray(e,t){let n=(e-this.size.width/2)/this.focal,r=(t-this.size.height/2)/this.focal,{forward:i,right:a,down:o}=this,s=[i[0]+a[0]*n+o[0]*r,i[1]+a[1]*n+o[1]*r,i[2]+a[2]*n+o[2]*r],c=Math.hypot(...s);return[s[0]/c,s[1]/c,s[2]/c]}pick(e,t,n){let r=this.ray(e,t),i=e=>[this.eye[0]+r[0]*e,this.eye[1]+r[1]*e,this.eye[2]+r[2]*e],a=e=>{let t=i(e);return t[2]-xr(n,t[0],t[1],this.stretch)},o=Math.max(.4,this.near),s=this.near;if(a(s)<0)return null;for(let e=s+o;e<this.far;e+=o){if(a(e)<=0){let t=s,n=e;for(;n-t>.01;){let e=(t+n)/2;a(e)>0?t=e:n=e}let r=i(n);return r[0]<0||r[1]<0||r[0]>1e3||r[1]>530?null:[r[0],r[1]]}if(s=e,r[2]>=0&&i(e)[2]>this.eye[2]+1)return null}return null}};function Cr(e,t,n,r,i){let{pitch:a,bearing:o}=t,s=[Math.sin(o),-Math.cos(o)],c=[Math.cos(o),Math.sin(o)],l=i/(e.k*Math.cos(a));return Tr({x:e.x-c[0]*r/e.k+s[0]*l,y:e.y-c[1]*r/e.k+s[1]*l,k:e.k},n)}function wr(e,t,n){return Tr({...e,k:e.k*n},t)}function Tr(e,t){let n=H(t);return{x:Math.min(Math.max(e.x,0),V),y:Math.min(Math.max(e.y,0),530),k:Math.min(Math.max(e.k,n),n*40)}}const Er=.006;var Dr=class{constructor(){this.pointers=/* @__PURE__ */ new Map,this.travelled=0,this.pinched=!1,this.lastTap=null,this.twoFingers=`undecided`,this.starts=/* @__PURE__ */ new Map,this.twist=0,this.turning=!1}get active(){return this.pointers.size>0}down(e,t,n){this.pointers.size===0&&(this.travelled=0,this.pinched=!1),this.pointers.set(e,{x:t,y:n}),this.pointers.size>1&&(this.pinched=!0),this.pointers.size===2&&(this.twoFingers=`undecided`,this.starts=new Map([...this.pointers].map(([e,t])=>[e,{...t}])),this.twist=0,this.turning=!1)}movePose(e,t,n,r,i,a){let o=this.pointers.get(e);if(o===void 0)return null;let{camera:s,orientation:c}=r,l=vr(c);if(this.pointers.size===1){let e=t-o.x,u=n-o.y;return o.x=t,o.y=n,this.travelled+=Math.abs(e)+Math.abs(u),this.travelled<=6?r:a?{camera:s,orientation:br(c,-u*Er,-e*.006)}:{camera:l?wn(s,i,e,u):Cr(s,c,i,e,u),orientation:c}}if(this.pointers.size!==2)return r;let u=this.spread(),d=n-o.y;o.x=t,o.y=n;let f=this.spread();if(this.twoFingers===`undecided`&&(this.twoFingers=this.decide()),this.twoFingers===`undecided`)return r;if(this.twoFingers===`tilt`)return{camera:s,orientation:br(c,-d/2*Er,0)};let p=c,m=f.angle-u.angle,h=Math.atan2(Math.sin(m),Math.cos(m));this.turning?p=br(c,0,-h):(this.twist+=h,Math.abs(this.twist)>.21&&(this.turning=!0,p=br(c,0,-this.twist)));let g=u.distance>0?f.distance/u.distance:1;return l&&vr(p)?{camera:wn(Cn(s,i,u.x,u.y,g),i,f.x-u.x,f.y-u.y),orientation:p}:{camera:Cr(wr(s,i,g),p,i,f.x-u.x,f.y-u.y),orientation:p}}decide(){let[e,t]=[...this.pointers].map(([e,t])=>{let n=this.starts.get(e)??t;return{dx:t.x-n.x,dy:t.y-n.y}});if(Math.max(Math.hypot(e.dx,e.dy),Math.hypot(t.dx,t.dy))<10)return`undecided`;let n=e=>Math.abs(e.dy)>1.5*Math.abs(e.dx);return n(e)&&n(t)&&Math.sign(e.dy)===Math.sign(t.dy)?`tilt`:`pinch`}move(e,t,n,r,i){let a=this.pointers.get(e);if(a===void 0)return null;if(this.pointers.size===1){let e=t-a.x,o=n-a.y;return a.x=t,a.y=n,this.travelled+=Math.abs(e)+Math.abs(o),this.travelled>6?wn(r,i,e,o):r}if(this.pointers.size!==2)return r;let o=this.spread();a.x=t,a.y=n;let s=this.spread();return wn(Cn(r,i,o.x,o.y,o.distance>0?s.distance/o.distance:1),i,s.x-o.x,s.y-o.y)}up(e,t,n){let r=this.pointers.get(e);if(r===void 0||(this.pointers.delete(e),t||this.pinched||this.travelled>6||this.pointers.size>0))return`none`;let i=this.lastTap;return i!==null&&n-i.time<=320&&Math.hypot(r.x-i.x,r.y-i.y)<=30?(this.lastTap=null,`double-tap`):(this.lastTap={x:r.x,y:r.y,time:n},`tap`)}reset(){this.pointers.clear()}spread(){let[e,t]=[...this.pointers.values()];return{x:(e.x+t.x)/2,y:(e.y+t.y)/2,distance:Math.hypot(e.x-t.x,e.y-t.y),angle:Math.atan2(t.y-e.y,t.x-e.x)}}};const q=1.6,Or={ArrowLeft:{kind:`pan`,dx:64,dy:0},ArrowRight:{kind:`pan`,dx:-64,dy:0},ArrowUp:{kind:`pan`,dx:0,dy:64},ArrowDown:{kind:`pan`,dx:0,dy:-64},"+":{kind:`zoom`,factor:q},"=":{kind:`zoom`,factor:q},"-":{kind:`zoom`,factor:1/q},0:{kind:`reset`},Enter:{kind:`identify`}},kr=10*Math.PI/180,Ar=15*Math.PI/180,jr={ArrowUp:{kind:`orient`,pitch:kr,bearing:0},ArrowDown:{kind:`orient`,pitch:-kr,bearing:0},ArrowLeft:{kind:`orient`,pitch:0,bearing:Ar},ArrowRight:{kind:`orient`,pitch:0,bearing:-Ar}};function Mr(e,t=!1,n=!1){return t&&n&&jr[e]!==void 0?jr[e]:Or[e]??null}function Nr(e){return Math.exp(-Math.max(-120,Math.min(120,e))*.004)}const Pr={background:[255,255,255],text:[33,33,33],muted:[114,114,114],accent:[3,169,244],dark:!1,font:`Roboto, Noto, sans-serif`},Fr={background:[28,28,28],text:[225,225,225],muted:[155,155,155],accent:[3,169,244],dark:!0,font:`Roboto, Noto, sans-serif`},Ir=e=>Math.round(Math.min(255,Math.max(0,e))),J=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],Y=(e,t=1)=>t>=1?`rgb(${Ir(e[0])}, ${Ir(e[1])}, ${Ir(e[2])})`:`rgba(${Ir(e[0])}, ${Ir(e[1])}, ${Ir(e[2])}, ${t})`;function Lr(e){let t=/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(e.trim());if(t)return t[4]!==void 0&&Rr(t[4])<.5?null:[Number(t[1]),Number(t[2]),Number(t[3])];let n=/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(e.trim());return n?n[4]!==void 0&&Rr(n[4])<.5?null:[Number(n[1])*255,Number(n[2])*255,Number(n[3])*255]:null}const Rr=e=>e.endsWith(`%`)?Number(e.slice(0,-1))/100:Number(e),zr=[236,152,54],Br=[214,140,62],Vr=[30,84,160],Hr=[111,157,198],Ur=[92,148,204];function Wr(e){let{background:t,text:n,dark:r}=e,i=r?Ur:Hr,a=J(J(t,n,r?.09:.065),i,.05),o=r?[214,226,236]:[52,64,74];return{dark:r,font:e.font,land:Y(a),water:Y(i),waterLabel:Y(J(i,n,r?.35:.42)),outline:Y(J(a,n,.72)),province:Y(J(a,n,.58)),district:Y(J(a,n,.44)),municipality:Y(J(a,n,.3)),label:Y(n),labelMuted:Y(J(e.muted,n,.25)),halo:Y(a,.82),accent:Y(e.accent),accentFill:Y(e.accent,.18),motorway:Y(r?Br:zr),motorwayCasing:Y(r?J(Br,t,.55):J(zr,[60,30,0],.45)),shield:Y(Vr),shieldText:`rgb(255, 255, 255)`,band:e=>{let t=Math.max(0,(e-400)/300+1);return Y(J(a,o,1-.948**t))}}}const Gr={background:`--amc-background`,text:`--amc-text`,muted:`--amc-muted`,accent:`--amc-accent`};function Kr(e,t){if(!e.isConnected)return null;e.style.setProperty(`transition`,`none`,`important`);let n=t=>(e.style.color=`var(${t})`,Lr(getComputedStyle(e).color)),r=t?Fr:Pr,i=n(Gr.text),a=n(Gr.accent),o=n(Gr.muted),s=n(Gr.background)??r.background,c=getComputedStyle(e).fontFamily||r.font;return e.style.color=``,i===null||a===null?null:{background:s,text:i,muted:o??i,accent:a,dark:t,font:c}}const qr=e=>e.scale<1?2:1,Jr=(()=>{let e=40*Math.PI/180,t=[-Math.cos(e)/Math.SQRT2,-Math.cos(e)/Math.SQRT2,Math.sin(e)];return new Float32Array(t)})();function Yr(e,t,n){let r=e.createProgram();if(r===null)throw Error(`no program`);if(e.attachShader(r,Zr(e,e.VERTEX_SHADER,t)),e.attachShader(r,Zr(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(`program: ${e.getProgramInfoLog(r)??`did not link`}`);return r}const Xr=(e,t,n)=>Object.fromEntries(n.map(n=>[n,e.getUniformLocation(t,n)]));function Zr(e,t,n){let r=e.createShader(t);if(r===null)throw Error(`no shader`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(`shader: ${e.getShaderInfoLog(r)??`did not compile`}`);return r}var Qr=class e{static create(t){let n=null;try{n=t.getContext(`webgl2`,{alpha:!0,antialias:!0,premultipliedAlpha:!0})}catch{n=null}if(n===null||!(n instanceof WebGL2RenderingContext))return null;try{return new e(t,n)}catch(e){return console.warn(`[austria-map-card] no 3D view:`,e),null}}constructor(e,t){this.lines=/* @__PURE__ */ new Map,this.drapeKey=``,this.lostContext=!1,this.gl=t;let n=Yr(t,`#version 300 es
uniform highp sampler2D u_height;
uniform mat4 u_matrix;
uniform int u_stride;
uniform ivec2 u_grid;
uniform float u_zscale;
uniform vec2 u_map;
out vec2 v_uv;
out vec3 v_normal;

float heightAt(ivec2 cell) {
  return texelFetch(u_height, clamp(cell, ivec2(0), u_grid - 1), 0).r * u_zscale;
}

void main() {
  ivec2 cell = ivec2((gl_VertexID >> 1) * u_stride, (gl_InstanceID + (gl_VertexID & 1)) * u_stride);
  cell = min(cell, u_grid - 1);
  vec2 at = vec2(cell) + 0.5;
  ivec2 dx = ivec2(u_stride, 0);
  ivec2 dy = ivec2(0, u_stride);
  float run = 2.0 * float(u_stride);
  v_normal = vec3(
    (heightAt(cell - dx) - heightAt(cell + dx)) / run,
    (heightAt(cell - dy) - heightAt(cell + dy)) / run,
    1.0
  );
  v_uv = at / u_map;
  gl_Position = u_matrix * vec4(at, heightAt(cell), 1.0);
}
`,`#version 300 es
precision mediump float;
uniform sampler2D u_drape;
uniform vec3 u_light;
uniform float u_shade;
in vec2 v_uv;
in vec3 v_normal;
out vec4 colour;

void main() {
  vec4 map = texture(u_drape, v_uv);
  // Abroad: the flat map draws nothing there.
  if (map.a < 0.5) discard;
  float light = dot(normalize(v_normal), u_light);
  // Flat ground keeps its colour; slopes facing the light brighten, the
  // others darken.
  float shade = 1.0 + u_shade * (light - u_light.z);
  colour = vec4(map.rgb / map.a * shade, 1.0);
}
`);this.program=n,this.uniforms=Xr(t,n,[`u_height`,`u_matrix`,`u_stride`,`u_grid`,`u_zscale`,`u_map`,`u_drape`,`u_light`,`u_shade`]),this.lineProgram=Yr(t,`#version 300 es
uniform highp sampler2D u_height;
uniform mat4 u_matrix;
uniform ivec2 u_grid;
uniform int u_stride;
uniform float u_zscale;
uniform float u_lift;
uniform vec2 u_half;
uniform float u_width;
in vec4 a_segment;
out float v_across;

float texel(ivec2 cell) {
  return texelFetch(u_height, clamp(cell, ivec2(0), u_grid - 1), 0).r;
}

float groundAt(vec2 at) {
  float s = float(u_stride);
  vec2 f = (at - 0.5) / s;
  vec2 base = floor(f);
  vec2 t = f - base;
  ivec2 c = ivec2(base) * u_stride;
  ivec2 right = ivec2(u_stride, 0);
  ivec2 down = ivec2(0, u_stride);
  // The mesh's strip runs top, bottom, top, bottom: its triangles meet on
  // the diagonal from the bottom-left corner to the top-right one.
  float h;
  if (t.x + t.y <= 1.0) {
    float h00 = texel(c);
    h = h00 + (texel(c + right) - h00) * t.x + (texel(c + down) - h00) * t.y;
  } else {
    float h11 = texel(c + right + down);
    h = h11 + (texel(c + down) - h11) * (1.0 - t.x) + (texel(c + right) - h11) * (1.0 - t.y);
  }
  return h * u_zscale + u_lift;
}

void main() {
  float along = float(gl_VertexID >> 1);
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  vec4 a = u_matrix * vec4(a_segment.xy, groundAt(a_segment.xy), 1.0);
  vec4 b = u_matrix * vec4(a_segment.zw, groundAt(a_segment.zw), 1.0);
  if (a.w <= 0.0 || b.w <= 0.0) {
    // Behind the eye: nothing to draw.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_across = 0.0;
    return;
  }
  vec2 sa = a.xy / a.w * u_half;
  vec2 sb = b.xy / b.w * u_half;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  float reach = u_width * 0.5 + 1.0;
  vec4 end = along > 0.5 ? b : a;
  vec2 at = (along > 0.5 ? sb : sa) + normal * side * reach + dir * (along * 2.0 - 1.0) * u_width * 0.5;
  v_across = side * reach;
  gl_Position = vec4(at / u_half * end.w, end.z, end.w);
}
`,`#version 300 es
// highp: u_width is shared with the vertex shader, and a uniform must have
// the same precision in both or the program does not link.
precision highp float;
uniform vec3 u_colour;
uniform float u_width;
in float v_across;
out vec4 colour;

void main() {
  // Full inside the line, fading over the last pixel: lines thinner than a
  // pixel come out fainter, not jagged.
  float cover = clamp(u_width * 0.5 + 0.5 - abs(v_across), 0.0, 1.0) * min(u_width, 1.0);
  if (cover <= 0.0) discard;
  colour = vec4(u_colour * cover, cover);
}
`),this.lineUniforms=Xr(t,this.lineProgram,[`u_height`,`u_matrix`,`u_grid`,`u_stride`,`u_zscale`,`u_lift`,`u_half`,`u_width`,`u_colour`]);let r=()=>{let e=t.createTexture();if(e===null)throw Error(`no texture`);return e};this.heights=r(),this.drape=r(),e.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),this.lostContext=!0})}get lost(){return this.lostContext||this.gl.isContextLost()}get hasRelief(){return this.relief!==void 0}setRelief(e){if(this.relief===e)return;let{gl:t}=this;this.relief=e,t.bindTexture(t.TEXTURE_2D,this.heights),t.pixelStorei(t.UNPACK_ALIGNMENT,1),t.texImage2D(t.TEXTURE_2D,0,t.R32F,e.columns,e.rows,0,t.RED,t.FLOAT,e.metres),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST)}setDrape(e,t){if(t===this.drapeKey)return;let{gl:n}=this;this.drapeKey=t,n.bindTexture(n.TEXTURE_2D,this.drape),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,e),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.generateMipmap(n.TEXTURE_2D),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR_MIPMAP_LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE);let r=n.getExtension(`EXT_texture_filter_anisotropic`);if(r!==null){let e=n.getParameter(r.MAX_TEXTURE_MAX_ANISOTROPY_EXT);n.texParameterf(n.TEXTURE_2D,r.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,e))}}resize(e,t,n,r){let i=Math.min(r||1,2),a=Math.max(1,Math.round(t*i)),o=Math.max(1,Math.round(n*i));e.width!==a&&(e.width=a),e.height!==o&&(e.height=o)}clear(){let{gl:e}=this;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT)}lineBuffer(e){let t=this.lines.get(e.key);if(t!==void 0)return t;let{gl:n}=this,r=e.segments();if(r.length===0)return null;let i=n.createVertexArray(),a=n.createBuffer();if(i===null||a===null)return null;n.bindVertexArray(i),n.bindBuffer(n.ARRAY_BUFFER,a),n.bufferData(n.ARRAY_BUFFER,r,n.STATIC_DRAW);let o=n.getAttribLocation(this.lineProgram,`a_segment`);n.enableVertexAttribArray(o),n.vertexAttribPointer(o,4,n.FLOAT,!1,0,0),n.vertexAttribDivisor(o,1),n.bindVertexArray(null);let s={vao:i,buffer:a,count:r.length/4};return this.lines.set(e.key,s),s}drawLines(e,t){let{gl:n,relief:r,lineUniforms:i}=this;if(r===void 0||t.length===0)return;let a=n.drawingBufferHeight/Math.max(e.size.height,1);n.useProgram(this.lineProgram),n.enable(n.DEPTH_TEST),n.depthFunc(n.LEQUAL),n.depthMask(!1),n.enable(n.BLEND),n.blendFunc(n.ONE,n.ONE_MINUS_SRC_ALPHA),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.heights),n.uniform1i(i.u_height,0),n.uniformMatrix4fv(i.u_matrix,!1,e.matrix()),n.uniform2i(i.u_grid,r.columns,r.rows),n.uniform1i(i.u_stride,qr(e)),n.uniform1f(i.u_zscale,e.stretch/585),n.uniform1f(i.u_lift,e.distance*.0015),n.uniform2f(i.u_half,n.drawingBufferWidth/2,n.drawingBufferHeight/2);for(let e of t){let t=this.lineBuffer(e);t!==null&&(n.uniform1f(i.u_width,e.width*a),n.uniform3f(i.u_colour,e.colour[0]/255,e.colour[1]/255,e.colour[2]/255),n.bindVertexArray(t.vao),n.drawArraysInstanced(n.TRIANGLE_STRIP,0,4,t.count))}n.bindVertexArray(null),n.depthMask(!0),n.disable(n.BLEND),n.disable(n.DEPTH_TEST)}draw(e,t=[]){let{gl:n,relief:r,uniforms:i}=this;if(n.viewport(0,0,n.drawingBufferWidth,n.drawingBufferHeight),this.clear(),r===void 0||this.drapeKey===``||this.lost)return;n.enable(n.DEPTH_TEST),n.useProgram(this.program),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.heights),n.uniform1i(i.u_height,0),n.activeTexture(n.TEXTURE1),n.bindTexture(n.TEXTURE_2D,this.drape),n.uniform1i(i.u_drape,1);let a=qr(e);n.uniformMatrix4fv(i.u_matrix,!1,e.matrix()),n.uniform1i(i.u_stride,a),n.uniform2i(i.u_grid,r.columns,r.rows),n.uniform1f(i.u_zscale,e.stretch/585),n.uniform2f(i.u_map,V,530),n.uniform3fv(i.u_light,Jr),n.uniform1f(i.u_shade,.45);let o=Math.ceil((r.columns-1)/a)+1,s=Math.ceil((r.rows-1)/a);n.drawArraysInstanced(n.TRIANGLE_STRIP,0,o*2,s),n.disable(n.DEPTH_TEST),this.drawLines(e,t)}};function $r(e,t,n,r){let i=[],a=(e,t)=>{if(e===t)return;let n=Math.min(e,t),r=Math.max(e,t);for(let a=Math.floor(n)+1;a<r;a+=1)i.push((a-e)/(t-e))};return a(e-.5,n-.5),a(t-.5,r-.5),a(e+t,n+r),i.sort((e,t)=>e-t)}function X(e,t,n=e.closed){let{xy:r,start:i}=e,a=[],o=(e,t,n,r)=>{let i=0;for(let o of[...$r(e,t,n,r),1])o-i<1e-6||(a.push(e+(n-e)*i,t+(r-t)*i,e+(n-e)*o,t+(r-t)*o),i=o)};for(let a=0;a<e.count;a+=1){if(!t(a))continue;let e=i[a],s=i[a+1];for(let t=e;t+1<s;t+=1)o(r[t*2],r[t*2+1],r[t*2+2],r[t*2+3]);n&&s-e>2&&o(r[(s-1)*2],r[(s-1)*2+1],r[e*2],r[e*2+1])}return Float32Array.from(a)}function ei(e){let t=e.reduce((e,t)=>e+t.length/2,0),n=new Float32Array(t*2),r=new Uint32Array(e.length+1),i=0;return e.forEach((e,t)=>{r[t]=i,n.set(e,i*2),i+=e.length/2}),r[e.length]=i,{xy:n,start:r,count:e.length,closed:!0}}const ti=e=>Lr(e)??[0,0,0];function ni(e,t,n,r,i){let a=[];if(t.has(`rivers`)){let t=Xn(e,n);if(t!==void 0){let{rivers:e}=t;for(let r=t.minOrder;r<=9;r+=1)a.push({key:`rivers:${t.set}:${r}`,segments:()=>X(e.lines,t=>e.order[t]===r),colour:ti(i.water),width:W(Yn[r]??.45,n)})}}let o=[i.outline,i.province,i.district,i.municipality],s=(e,t,r)=>{a.push({key:t,segments:r,colour:ti(o[e]),width:W(Mn[e],n)})},c=or(e,t,n)&&e.detail!==void 0;if(t.has(`municipalities`)&&n>=U.municipalities&&e.municipalArcs!==void 0){let t=e.municipalArcs;s(3,`borders:municipal`,()=>X(t.lines,()=>!0))}if(c){let n=e.detail,r=[0,1,2].filter(e=>e===0||(e===1?t.has(`provinces`):t.has(`districts`)));for(let e of r.reverse())s(e,`borders:fine:${e}`,()=>X(n.arcs.lines,t=>n.level[t]===e))}else if(e.overview!==void 0){let{arcs:n}=e.overview;t.has(`provinces`)&&s(1,`borders:coarse:1`,()=>X(n.lines,e=>n.a[e]>=0)),s(0,`borders:coarse:0`,()=>X(n.lines,e=>n.a[e]<0))}let l=t.has(`motorways`)?e.motorways:void 0;if(l!==void 0){let e=()=>X(l.lines,()=>!0),t=a.findIndex(e=>e.key.startsWith(`borders:`)&&e.key.endsWith(`:0`));a.splice(t<0?a.length:t,0,{key:`motorways`,segments:e,colour:ti(i.motorwayCasing),width:W(zn,n)},{key:`motorways`,segments:e,colour:ti(i.motorway),width:W(2,n)})}let u=ti(i.accent);if(r?.kind===`motorway`){let t=Vn(e,r.ref);if(t!==void 0){let e=new Set(t.which);a.push({key:`selected:motorway:${r.ref}`,segments:()=>X(t.lines,t=>e.has(t)),colour:u,width:W(3.2,n)})}}else if(r?.kind===`river`){let t=er(e,n,r.name);if(t!==void 0){let e=new Set(t.which);a.push({key:`selected:river:${r.name}:${n>=U.riversDetail?`detail`:`overview`}:${e.size}`,segments:()=>X(t.lines,t=>e.has(t)),colour:u,width:W(2.6,n)})}}else if(r!==null&&r.kind!==`city`&&r.kind!==`peak`){let t=r.kind===`province`?c?e.detail?.provinceIndex:e.overview?.index:r.kind===`district`?e.detail?.districtIndex:e.municipalityIndex;t!==void 0&&a.push({key:`selected:${r.kind}:${r.row}:${c?`fine`:`coarse`}`,segments:()=>X(ei(t.rings(r.row)),()=>!0),colour:u,width:2})}return a}const ri=(e,t,n)=>e.x-n<t.x+t.w&&t.x<e.x+e.w+n&&e.y-n<t.y+t.h&&t.y<e.y+e.h+n;var ii=class{constructor(e,t){this.taken=[],this.bounds=e,this.margin=t}fits(e){let{bounds:t}=this;return e.every(e=>e.x>=t.x&&e.y>=t.y&&e.x+e.w<=t.x+t.w&&e.y+e.h<=t.y+t.h&&!this.taken.some(t=>ri(e,t,this.margin)))}take(e){this.taken.push(...e)}place(e){return this.fits(e)?(this.take(e),!0):!1}placeFirst(e){for(let t=0;t<e.length;t+=1)if(this.place([e[t]]))return t;return-1}get count(){return this.taken.length}};function ai(e,t,n,r,i){let a=n+3;return[{x:e+a,y:t-i/2,w:r,h:i},{x:e-a-r,y:t-i/2,w:r,h:i},{x:e-r/2,y:t-a-i,w:r,h:i},{x:e-r/2,y:t+a,w:r,h:i}]}const oi=(e,t,n,r)=>({x:e-n/2,y:t-r/2,w:n,h:r});function si(e){let t=new Float32Array(e.length/2);for(let n=1;n<t.length;n+=1)t[n]=t[n-1]+Math.hypot(e[n*2]-e[n*2-2],e[n*2+1]-e[n*2-1]);return{xy:e,along:t}}function ci(e,t){let{xy:n,along:r}=e,i=r.length-1;if(t<=0)return[n[0],n[1]];if(t>=r[i])return[n[i*2],n[i*2+1]];let a=0,o=i;for(;o-a>1;){let e=a+o>>1;r[e]<=t?a=e:o=e}let s=r[o]-r[a],c=s===0?0:(t-r[a])/s;return[n[a*2]+c*(n[o*2]-n[a*2]),n[a*2+1]+c*(n[o*2+1]-n[a*2+1])]}function li(e,t){let{xy:n,along:r}=e,i=null,a=null,o=()=>{a!==null&&(i===null||a[1]-a[0]>i[1]-i[0])&&(i=a),a=null};for(let e=0;e+1<r.length;e+=1){let i=n[e*2],s=n[e*2+1],c=n[e*2+2]-i,l=n[e*2+3]-s,u=0,d=1,f=[[-c,i-t.x],[c,t.x+t.w-i],[-l,s-t.y],[l,t.y+t.h-s]];for(let[e,t]of f)e===0?t<0&&(u=2):e<0?u=Math.max(u,t/e):d=Math.min(d,t/e);if(u>d){o();continue}let p=r[e+1]-r[e],m=r[e]+u*p,h=r[e]+d*p;a!==null&&u===0?a=[a[0],h]:(o(),a=[m,h]),d<1&&o()}return o(),i}const ui=100*Math.PI/180,di=28*Math.PI/180;function fi(e,t,n,r,i){let a=r.reduce((e,t)=>e+t,0)+i*(n.length-1),o=t-a/2,[s]=ci(e,o),[c]=ci(e,o+a),l=c>=s?1:-1,u=[],d=l===1?o:o+a,f;for(let t=0;t<n.length;t+=1){let a=r[t],o=d+l*a/2,s=Math.max(a,6),[c,p]=ci(e,o-l*s),[m,h]=ci(e,o+l*s),g=Math.atan2(h-p,m-c);if(Math.abs(g)>ui||f!==void 0&&Math.abs(g-f)>di)return null;f=g;let[_,v]=ci(e,o);u.push({char:n[t],x:_,y:v,angle:g,width:a}),d+=l*(a+i)}return u}const pi=(e,t)=>e.map(e=>{let n=Math.max(e.width,t);return{x:e.x-n/2,y:e.y-n/2,w:n,h:n}}),Z={provincesBelow:4.5,districtsFrom:1.1,municipalitiesFrom:4,rivers:{9:0,8:0,7:0,6:.9,5:1.6,4:3.5,3:7},riverSweep:[.95,2.4],shortNamesBelow:3};function mi(e){return e<Z.riverSweep[0]?2:+(e<Z.riverSweep[1])}const hi=e=>e.replace(/\s*[[(].*$/,``),gi=e=>e.replace(/ (am|an der|im|in|bei|ob) .*$/,``),Q=4.5,_i=[{font:`700 13px`,size:13,radius:3.8,ringed:!0},{font:`600 12.5px`,size:12.5,radius:3.3,ringed:!0},{font:`500 12px`,size:12,radius:2.6,ringed:!1},{font:`400 11.5px`,size:11.5,radius:2.2,ringed:!1},{font:`400 11px`,size:11,radius:1.8,ringed:!1}],vi=/* @__PURE__ */ new Map;function yi(e,t,n,r=``){let i=`${t}\n${r}\n${n}`,a=vi.get(i);return a===void 0&&(vi.size>6e3&&vi.clear(),e.font=t,a=e.measureText(n).width,vi.set(i,a)),a}const bi=/* @__PURE__ */ new WeakMap;function xi(e){let t=bi.get(e);if(t===void 0){t=[];for(let n=0;n<e.count;n+=1)Jn(e,n)<=1&&t.push(n);bi.set(e,t)}return t}const Si=/* @__PURE__ */ new WeakMap;function Ci(e){let t=Si.get(e);if(t===void 0){let{xy:n,start:r}=e.lines,i=e=>{let t=0;for(let i=r[e]+1;i<r[e+1];i+=1)t+=Math.hypot(n[i*2]-n[i*2-2],n[i*2+1]-n[i*2-1]);return t},a=Array.from({length:e.lines.count},(e,t)=>i(t));t=a.map((e,t)=>t).sort((e,t)=>a[t]-a[e]||e-t),Si.set(e,t)}return t}const wi=/* @__PURE__ */ new WeakMap;function Ti(e){let t=wi.get(e);if(t===void 0){let n=t=>Math.hypot(e.labelBoxes[t*4+2]-e.labelBoxes[t*4],e.labelBoxes[t*4+3]-e.labelBoxes[t*4+1]);t=Array.from({length:e.labels.count},(e,t)=>t).sort((t,r)=>e.labelOrder[r]-e.labelOrder[t]||n(r)-n(t)||t-r),wi.set(e,t)}return t}function Ei(e){let{ctx:t,store:n,palette:r,camera:i,size:a,box:o,layers:s,showLabels:c,selection:l}=e,u=i.k,d=r.font,f=new ii({x:0,y:0,w:a.width,h:a.height},3),p=[],m=e.project??((e,t)=>bn(i,a,e,t)),h=(e,t)=>{if(e<o[0]||e>o[2]||t<o[1]||t>o[3])return null;let n=m(e,t);return n!==null&&n[0]>=0&&n[0]<=a.width&&n[1]>=0&&n[1]<=a.height?n:null};t.textBaseline=`middle`,t.lineJoin=`round`;let g=(e,n,i,a,o,s)=>{t.font=n,t.textAlign=s,t.lineWidth=3,t.strokeStyle=r.halo,t.strokeText(e,a,o),t.fillStyle=i,t.fillText(e,a,o)},_=s.has(`cities`)?n.places:void 0,v=/* @__PURE__ */ new Set,y=_?.facts.find(e=>e.key===`municipality_population`)?.values,b=/* @__PURE__ */ new Set,x=(e,n)=>{if(_===void 0||v.has(e))return!1;let i=_.at[e*2],a=_.at[e*2+1],o=h(i,a);if(o===null)return!1;let[s,l]=o,m=_i[Jn(_,e)],x=`${m.font} ${d}`,S={x:s-m.radius-1,y:l-m.radius-1,w:m.radius*2+2,h:m.radius*2+2},C=null,w=Jn(_,e)<=1&&u<Z.shortNamesBelow?gi(_.names[e]):_.names[e];if(c){let e=ai(s,l,m.radius,yi(t,x,w),m.size+2);if(f.fits([S])){let t=f.placeFirst(e);if(t>=0)C=e[t];else if(!n)return!1}else if(!n)return!1}else if(!n&&!f.fits([S]))return!1;return f.take([S]),v.add(e),t.beginPath(),t.arc(s,l,m.radius+1.2,0,Math.PI*2),t.fillStyle=r.halo,t.fill(),t.beginPath(),t.arc(s,l,m.radius,0,Math.PI*2),t.fillStyle=r.label,t.fill(),m.ringed&&(t.beginPath(),t.arc(s,l,m.radius*.42,0,Math.PI*2),t.fillStyle=r.land,t.fill()),C!==null&&(g(w,x,r.label,C.x,C.y+C.h/2,`left`),y?.[e]>0&&b.add(_.municipality[e])),p.push({kind:`city`,row:e,x:s,y:l,radius:m.radius,label:C}),!0};if(_!==void 0){l?.kind===`city`&&x(l.row,!0);for(let e of xi(_))x(e,!0)}let S=(e,n,r,i,a,o,s,c)=>{let l=s>0&&`letterSpacing`in t;l&&(t.letterSpacing=`${s}px`);let p=`${r} ${d}`;for(let r=0;r<e.count;r+=1){if(c?.has(r))continue;let d=e.at[r*2],m=e.at[r*2+1],_=h(d,m);if(_===null)continue;let v=o?e.names[r].toUpperCase():e.names[r],y=yi(t,p,v,l?`spaced ${s}`:``);if(n!==void 0){let[e,,t]=n.box(r);if((t-e)*u<y*.7)continue}let[b,x]=_,S=[0,-1.3,1.3,-2.6,2.6].map(e=>e*(i+2)),C=f.placeFirst(S.map(e=>oi(b,x+e,y,i+2)));C<0||g(v,p,a,b,x+S[C],`center`)}l&&(t.letterSpacing=`0px`)};if(c&&s.has(`provinces`)&&u<Z.provincesBelow&&n.overview!==void 0&&S(n.overview.provinces,void 0,`600 11px`,11,r.labelMuted,!0,1.2),_!==void 0){let e=qn(u);for(let t=0;t<_.count&&p.length<90&&!(_.rank[t]<e);t+=1)x(t,!1)}let C=s.has(`motorways`)?n.motorways:void 0;if(c&&C!==void 0){let e=`700 10px ${d}`,n=[],{xy:i,start:o}=C.lines;for(let s of Ci(C)){if(n.length>=16)break;let c=C.refs[C.route[s]],l=[];for(let e=o[s];e<o[s+1];e+=1){let t=m(i[e*2],i[e*2+1]);t!==null&&l.push(t[0],t[1])}if(l.length<4)continue;let u=si(l),d=u.along[u.along.length-1],p=yi(t,e,c)+8;for(let i=90;i<d&&n.length<16;i+=180){let[o,s]=ci(u,i);if(o<0||s<0||o>a.width||s>a.height||n.some(e=>e.ref===c&&Math.hypot(e.x-o,e.y-s)<240))continue;let l=oi(o,s,p,15);f.place([l])&&(n.push({ref:c,x:o,y:s}),t.beginPath(),t.roundRect(l.x,l.y,l.w,l.h,3),t.lineWidth=2,t.strokeStyle=r.halo,t.stroke(),t.fillStyle=r.shield,t.fill(),t.font=e,t.textAlign=`center`,t.fillStyle=r.shieldText,t.fillText(c,o,s+.5))}}}let w=s.has(`peaks`)?n.peaks:void 0;if(w!==void 0){let e=`italic 500 11px ${d}`,n=`400 10px ${d}`,i=(i,a)=>{let o=h(w.at[i*2],w.at[i*2+1]);if(o===null)return!1;let[s,l]=o,u={x:s-Q-1,y:l-Q-1,w:11,h:10},d=w.names[i],m=`${w.height[i]}`,_=yi(t,e,d),v=_+4+yi(t,n,m),y=null;if(!f.fits([u])&&!a)return!1;if(c){let e=ai(s,l,Q,v,13),t=f.placeFirst(e);if(t>=0)y=e[t];else if(!a)return!1}if(f.take([u]),t.beginPath(),t.moveTo(s,l-Q),t.lineTo(s+Q,l+Q*.75),t.lineTo(s-Q,l+Q*.75),t.closePath(),t.lineWidth=2,t.strokeStyle=r.halo,t.stroke(),t.fillStyle=r.label,t.fill(),y!==null){let t=y.y+y.h/2;g(d,e,r.label,y.x,t,`left`),g(m,n,r.labelMuted,y.x+_+4,t,`left`)}return p.push({kind:`peak`,row:i,x:s,y:l,radius:Q,label:y}),!0};l?.kind===`peak`&&i(l.row,!0);let a=0;for(let e=0;e<w.count&&a<40&&!(w.isolation[e]/10*(w.major[e]>0?2:1)*u<40);e+=1)(l?.kind!==`peak`||l.row!==e)&&i(e,!1)&&(a+=1)}if(c&&s.has(`rivers`)&&n.overview!==void 0){let e=Xn(n,u),i=[n.overview.rivers];e?.set===`detail`&&i.push(e.rivers);let s={x:6,y:6,w:a.width-12,h:a.height-12},c=[],l=mi(u),p=0;for(let e of i)for(let i of Ti(e)){if(p>=14)break;let a=e.labelOrder[i];if(u<(Z.rivers[a]??1/0)||e===n.overview.rivers&&e.labelLevel[i]!==l)continue;let h=i*4,g=e.labelBoxes;if(g[h]>o[2]||g[h+2]<o[0]||g[h+1]>o[3]||g[h+3]<o[1])continue;let _=e.labels.start[i],v=e.labels.start[i+1],y=new Float32Array((v-_)*2),b=!0;for(let t=_;t<v&&b;t+=1){let n=m(e.labels.xy[t*2],e.labels.xy[t*2+1]);n===null?b=!1:(y[(t-_)*2]=n[0],y[(t-_)*2+1]=n[1])}if(!b)continue;let x=si(y),S=li(x,s);if(S===null)continue;let C=e.labelName[i],w=hi(e.names[C]),T=a>=7?12:11,ee=`italic 400 ${T}px ${d}`,te=[...w],ne=te.map(e=>yi(t,ee,e)),re=1.2,ie=ne.reduce((e,t)=>e+t,0)+re*(te.length-1),E=(S[1]-S[0]-ie)/2-8;if(E<0)continue;let ae=(S[0]+S[1])/2,oe=null;for(let t of[0,-.45,.45,-.9,.9]){let n=fi(x,ae+t*E,te,ne,re),r=n?.[Math.floor(n.length/2)];if(n!==null&&r!==void 0&&!c.some(t=>t.set===e&&t.name===C&&Math.hypot(t.x-r.x,t.y-r.y)<260)&&f.place(pi(n,T))){oe=n,c.push({name:C,set:e,x:r.x,y:r.y});break}}if(oe!==null){t.font=ee,t.textAlign=`center`,t.lineWidth=3,t.strokeStyle=r.halo,t.fillStyle=r.waterLabel;for(let e of[`halo`,`ink`])for(let n of oe)t.save(),t.translate(n.x,n.y),t.rotate(n.angle),e===`halo`?t.strokeText(n.char,0,0):t.fillText(n.char,0,0),t.restore();p+=1}}}if(c&&n.detail!==void 0){s.has(`districts`)&&u>=Z.districtsFrom&&S(n.detail.districts,n.detail.districtIndex,`500 9.5px`,9.5,r.labelMuted,!0,.7);let e=n.municipalityIndex;s.has(`municipalities`)&&u>=Z.municipalitiesFrom&&e!==void 0&&S(n.detail.municipalities,e,`400 10px`,10,r.labelMuted,!1,0,b)}return p}function Di(e,t,n,r){let i=30/20;e.save(),e.translate(t-12*i,n-22*i),e.scale(i,i),e.beginPath(),e.moveTo(12,22),e.bezierCurveTo(12,22,5,14.25,5,9),e.arc(12,9,7,Math.PI,Math.PI*2),e.bezierCurveTo(19,14.25,12,22,12,22),e.closePath(),e.lineJoin=`round`,e.lineWidth=3/i,e.strokeStyle=r.land,e.stroke(),e.fillStyle=r.accent,e.fill(),e.beginPath(),e.arc(12,9,2.5,0,Math.PI*2),e.fillStyle=r.land,e.fill(),e.restore()}var Oi=class{constructor(e,t,n){this.width=0,this.height=0,this.dpr=1,this.cities=[],this.tilted=null;let r=e.getContext(`2d`);if(r===null)throw Error(`no 2D context`);this.canvas=e,this.ctx=r,this.store=t,this.shapes=new Dn(n)}get hasPalette(){return this.palette!==void 0}setPalette(e){this.palette=e}get size(){return{width:this.width,height:this.height}}resize(e,t,n,r=2400){let i=Math.min(n||1,2,r/Math.max(e,1));this.width=e,this.height=t,this.dpr=i,this.canvas.width=Math.max(1,Math.round(e*i)),this.canvas.height=Math.max(1,Math.round(t*i))}draw(e){let{ctx:t,store:n,palette:r,dpr:i}=this;t.setTransform(1,0,0,1,0,0),t.clearRect(0,0,this.canvas.width,this.canvas.height),this.cities=[],this.tilted=null;let a=n.overview;if(r===void 0||a===void 0||this.width===0)return;let{camera:o,layers:s}=e,c=this.size,l=o.k,u=or(n,s,l),d={ctx:t,store:n,palette:r,shapes:this.shapes,camera:o,size:c,scale:l,box:Sn(o,c),fine:u},f=(e,t)=>s.has(e)&&l>=t;t.setTransform(i*l,0,0,i*l,i*(c.width/2-o.x*l),i*(c.height/2-o.y*l));let p=u&&n.detail!==void 0?this.shapes.get(`country:fine`,e=>An(e,n.detail.country)):this.shapes.get(`country:coarse`,e=>An(e,a.country));t.fillStyle=r.land,t.fill(p,`evenodd`),t.save(),t.clip(p,`evenodd`);for(let e of G)e.clipped&&f(e.id,e.minScale)&&e.draw(d);if(t.restore(),e.fillsOnly!==!0){for(let e of G)!e.clipped&&f(e.id,e.minScale)&&e.draw(d);Fn(d,0)}e.selection!==null&&this.highlight(d,e.selection,e.fillsOnly!==!0),t.setTransform(i,0,0,i,0,0),this.cities=Ei({ctx:t,store:n,palette:r,camera:o,size:c,box:d.box,layers:s,showLabels:e.showLabels,selection:e.selection}),this.ringSelected(e.selection,r),e.here!==null&&Di(t,...bn(o,c,...e.here),r)}ringSelected(e,t){if(e?.kind!==`city`&&e?.kind!==`peak`)return;let{ctx:n}=this,r=this.cities.find(t=>t.kind===e.kind&&t.row===e.row);r!==void 0&&(n.beginPath(),n.arc(r.x,r.y,r.radius+4.5,0,Math.PI*2),n.lineWidth=2,n.strokeStyle=t.accent,n.stroke())}drawTilted(e,t){let{ctx:n,store:r,palette:i,dpr:a}=this;if(n.setTransform(1,0,0,1,0,0),n.clearRect(0,0,this.canvas.width,this.canvas.height),this.cities=[],this.tilted=t,i===void 0||r.overview===void 0||this.width===0)return;let o=r.relief,s=(e,n)=>t.projectGround(o,e,n);if(n.setTransform(a,0,0,a,0,0),this.cities=Ei({ctx:n,store:r,palette:i,camera:e.camera,size:this.size,box:[0,0,V,530],layers:e.layers,showLabels:e.showLabels,selection:e.selection,project:s}),this.ringSelected(e.selection,i),e.here!==null){let t=s(...e.here);t!==null&&Di(n,t[0],t[1],i)}}highlight(e,t,n){let{ctx:r,store:i,palette:a,scale:o}=e;if(r.lineJoin=`round`,r.lineCap=`round`,t.kind===`motorway`){if(!n)return;let e=Vn(i,t.ref);if(e===void 0)return;let s=this.shapes.get(`selected:motorway:${t.ref}`,t=>On(t,e.lines,e.which));r.strokeStyle=a.accent,r.lineWidth=W(3.2,o)/o,r.stroke(s);return}if(t.kind===`river`){if(!n)return;let e=er(i,o,t.name);if(e===void 0)return;let s=this.shapes.get(`selected:river:${t.name}:${o>=2?`detail`:`overview`}:${e.which.length}`,t=>On(t,e.lines,e.which));r.strokeStyle=a.accent,r.lineWidth=W(2.6,o)/o,r.stroke(s);return}let s=this.ringsOf(t,e.fine);if(s===void 0)return;let c=this.shapes.get(`selected:${t.kind}:${t.row}:${s.set}`,e=>An(e,s.rings()));r.fillStyle=a.accentFill,r.fill(c,`evenodd`),n&&(r.strokeStyle=a.accent,r.lineWidth=2/o,r.stroke(c))}ringsOf(e,t){let{store:n}=this;if(e.kind===`province`){let r=t&&n.detail!==void 0?n.detail.provinceIndex:n.overview?.index;return r===void 0?void 0:{set:t?`fine`:`coarse`,rings:()=>r.rings(e.row)}}if(e.kind===`district`&&n.detail!==void 0){let t=n.detail.districtIndex;return{set:`fine`,rings:()=>t.rings(e.row)}}if(e.kind===`municipality`){let t=n.municipalityIndex;return t===void 0?void 0:{set:`fine`,rings:()=>t.rings(e.row)}}}hit(e,t,n){let{store:r}=this,{camera:i,layers:a}=e,o=i.k,s,c=1/0;for(let e of this.cities){let r=e.label!==null&&t>=e.label.x&&t<=e.label.x+e.label.w&&n>=e.label.y&&n<=e.label.y+e.label.h?0:Math.hypot(t-e.x,n-e.y);r<=Math.max(12,e.radius+8)&&r<c&&(c=r,s=e)}if(s!==void 0)return{kind:s.kind,row:s.row};let l,u;if(this.tilted!==null){let e=this.tilted.pick(t,n,r.relief);if(e===null)return null;[l,u]=e}else[l,u]=xn(i,this.size,t,n);if(a.has(`motorways`)){let e=Un(r,l,u,7/o);if(e!==void 0)return{kind:`motorway`,ref:e}}if(a.has(`rivers`)){let e=nr(r,o,l,u,7/o);if(e!==void 0)return{kind:`river`,name:e.name,order:e.order}}let d=r.municipalityIndex,f=G.find(e=>e.id===`municipalities`);if(a.has(`municipalities`)&&d!==void 0&&o>=(f?.minScale??0)){let e=d.locate(l,u);if(e>=0)return{kind:`municipality`,row:e}}if(a.has(`districts`)&&r.detail!==void 0){let e=r.detail.districtIndex.locate(l,u);if(e>=0)return{kind:`district`,row:e}}if(a.has(`provinces`)){let e=(or(r,a,o)&&r.detail!==void 0?r.detail.provinceIndex:r.overview?.index)?.locate(l,u)??-1;if(e>=0)return{kind:`province`,row:e}}return null}boxOf(e){let{store:t}=this;switch(e.kind){case`province`:return(t.detail?.provinceIndex??t.overview?.index)?.box(e.row);case`district`:return t.detail?.districtIndex.box(e.row);case`municipality`:return t.municipalityIndex?.box(e.row);case`city`:{let n=t.places;if(n===void 0)return;let r=n.at[e.row*2],i=n.at[e.row*2+1];return[r-14,i-14,r+14,i+14]}case`peak`:{let n=t.peaks;if(n===void 0)return;let r=n.at[e.row*2],i=n.at[e.row*2+1];return[r-14,i-14,r+14,i+14]}case`river`:return tr(t,e.name);case`motorway`:return Hn(t,e.ref)}}};const ki=c`
  :host {
    /* No color-scheme here: Home Assistant sets it on the document from the
       active theme and the card inherits it. */
    display: block;

    /* Fill the grid cell the dashboard hands us. A sections view gives the
       cell WRAPPER a fixed pixel height whenever rows is numeric -- which a
       user causes just by dragging the row handle -- and styles nothing
       inside it. With display: block above, this element is ha-card's
       containing block, so ha-card's block-size: 100% resolves against this
       line; without it that percentage computes to auto and the card paints
       over the card below. The pair is guarded by tests/grid-cell.test.ts. */
    block-size: 100%;

    container-type: inline-size;
    container-name: austria-map-card;

    --amc-background: var(--ha-card-background, var(--card-background-color, #fff));
    --amc-text: var(--primary-text-color, #212121);
    --amc-muted: var(--secondary-text-color, #727272);
    --amc-accent: var(--austria-map-accent-color, var(--primary-color, #03a9f4));
    --amc-line: var(--divider-color, rgba(0, 0, 0, 0.12));
    --amc-pad-x: var(--ha-space-4, 16px);
    --amc-pad-y: var(--ha-space-3, 12px);
    --amc-control: 40px;
  }

  ha-card {
    /* overflow: hidden keeps a card taller than its cell clipped inside its
       own bounds instead of painting over its neighbour. */
    overflow: hidden;
    block-size: 100%;
    display: flex;
    flex-direction: column;
    color: var(--amc-text);
  }

  /* Resolves the tokens above for the canvas; never seen. */
  .probe {
    position: absolute;
    inline-size: 0;
    block-size: 0;
    overflow: hidden;
    visibility: hidden;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .title {
    margin: 0;
    padding: var(--amc-pad-y) var(--amc-pad-x) 0;
    font-size: var(--ha-font-size-l, 1.143rem);
    font-weight: var(--ha-font-weight-medium, 500);
    line-height: 1.3;
  }

  /* ── The map ─────────────────────────────────────────────────────────
     The stage takes the map's own proportions where the card's height is
     free (a masonry view) and whatever is left where it is fixed (a
     sections cell): flex may stretch or squeeze it. An explicit
     min-block-size is what lets it go below the height the aspect ratio
     asks for, and it is not 0 but the height of the four buttons on the
     map plus their margins: on a card 300 px wide the proportions alone
     would give 159 px, and the buttons would hang out over the panel
     below. */
  .stage {
    position: relative;
    flex: 1 1 auto;
    min-block-size: calc(4 * var(--amc-control) + 3 * var(--ha-space-1, 4px) + var(--ha-space-5, 20px));
    aspect-ratio: 1000 / 530;
    margin: var(--ha-space-2, 8px) var(--ha-space-2, 8px) 0;
    /* The relief canvas sits under the map canvas, inside the stage. */
    isolation: isolate;
  }
  canvas {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    display: block;
    border-radius: var(--ha-border-radius-md, 8px);
    cursor: grab;
    /* On the whole-country view there is nothing to drag, so a vertical
       swipe scrolls the dashboard and the card never traps the page. */
    touch-action: pan-y;
    -webkit-tap-highlight-color: transparent;
  }
  /* The tilted map, drawn with WebGL under the canvas that takes the
     pointer and carries the names. */
  canvas.relief {
    z-index: -1;
    pointer-events: none;
  }
  canvas.relief[hidden] {
    display: none;
  }
  canvas.zoomed,
  canvas.tilted {
    touch-action: none;
  }
  canvas.dragging {
    cursor: grabbing;
  }
  canvas:focus-visible {
    outline: 2px solid var(--amc-accent);
    outline-offset: -2px;
  }

  /* Marks the spot that Enter reads out, while the map has keyboard focus. */
  .crosshair {
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    inline-size: 22px;
    block-size: 22px;
    margin: -11px 0 0 -11px;
    pointer-events: none;
    display: none;
    background:
      linear-gradient(var(--amc-accent), var(--amc-accent)) center / 2px 100% no-repeat,
      linear-gradient(var(--amc-accent), var(--amc-accent)) center / 100% 2px no-repeat;
  }
  canvas:focus-visible ~ .crosshair {
    display: block;
  }

  /* ── Controls on the map ─────────────────────────────────────────── */
  .toolbar {
    position: absolute;
    inset-block-start: var(--ha-space-2, 8px);
    inset-inline-end: var(--ha-space-2, 8px);
    display: flex;
    flex-direction: column;
    gap: var(--ha-space-1, 4px);
  }
  .tool,
  .icon {
    inline-size: var(--amc-control);
    block-size: var(--amc-control);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-md, 8px);
    background: var(--amc-background);
    color: var(--amc-text);
    cursor: pointer;
    --mdc-icon-size: 20px;
  }
  .tool:disabled {
    cursor: default;
    color: var(--disabled-text-color, #9e9e9e);
  }
  .tool[aria-expanded="true"] {
    border-color: var(--amc-accent);
    color: var(--amc-accent);
  }
  .tool-gap {
    block-size: var(--ha-space-1, 4px);
  }

  .layers {
    position: absolute;
    inset-block-start: var(--ha-space-2, 8px);
    inset-inline-end: calc(var(--amc-control) + var(--ha-space-4, 16px));
    inline-size: min(260px, calc(100% - var(--amc-control) - var(--ha-space-6, 24px)));
    max-block-size: calc(100% - var(--ha-space-4, 16px));
    overflow-y: auto;
    padding: var(--ha-space-1, 4px);
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-lg, 12px);
    background: var(--amc-background);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.2));
  }
  .layers h3 {
    margin: 0;
    padding: var(--ha-space-2, 8px) var(--ha-space-2, 8px) var(--ha-space-1, 4px);
    font-size: var(--ha-font-size-s, 0.857rem);
    font-weight: var(--ha-font-weight-medium, 500);
    color: var(--amc-muted);
  }
  .layer {
    inline-size: 100%;
    min-block-size: var(--amc-control);
    display: flex;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    padding: var(--ha-space-1, 4px) var(--ha-space-2, 8px);
    border: 0;
    border-radius: var(--ha-border-radius-md, 8px);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
    --mdc-icon-size: 20px;
  }
  .layer:hover {
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
  }
  .layer-text {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .layer-note {
    font-size: var(--ha-font-size-s, 0.857rem);
    color: var(--amc-muted);
  }
  /* A switch drawn in CSS: on is told by position and by fill, not by
     colour alone (WCAG 1.4.1). */
  .switch {
    flex: none;
    inline-size: 34px;
    block-size: 20px;
    border-radius: 10px;
    border: 2px solid var(--amc-muted);
    box-sizing: border-box;
    position: relative;
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  .switch::after {
    content: "";
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;
    background: var(--amc-muted);
    transition: transform 120ms ease, background-color 120ms ease;
  }
  .layer[aria-checked="true"] .switch {
    background: var(--amc-accent);
    border-color: var(--amc-accent);
  }
  .layer[aria-checked="true"] .switch::after {
    transform: translateX(14px);
    background: var(--amc-background);
  }
  :host(:dir(rtl)) .layer[aria-checked="true"] .switch::after {
    transform: translateX(-14px);
  }

  /* ── Messages on the map ─────────────────────────────────────────── */
  .toast,
  .notice {
    position: absolute;
    inset-inline: var(--ha-space-2, 8px);
    inset-block-end: var(--ha-space-2, 8px);
    margin-inline: auto;
    inline-size: fit-content;
    max-inline-size: calc(100% - var(--ha-space-4, 16px));
    padding: var(--ha-space-2, 8px) var(--ha-space-3, 12px);
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-md, 8px);
    background: var(--amc-background);
    font-size: var(--ha-font-size-s, 0.857rem);
    line-height: 1.35;
  }
  .toast {
    pointer-events: none;
  }
  .notice {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ha-space-2, 8px);
  }
  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--amc-muted);
    pointer-events: none;
  }

  .text {
    min-block-size: var(--amc-control);
    padding: 0 var(--ha-space-3, 12px);
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-md, 8px);
    background: none;
    color: var(--amc-accent);
    font: inherit;
    font-weight: var(--ha-font-weight-medium, 500);
    cursor: pointer;
  }

  /* ── What was tapped ─────────────────────────────────────────────── */
  .info {
    display: flex;
    align-items: flex-start;
    gap: var(--ha-space-2, 8px);
    padding: var(--ha-space-2, 8px) var(--amc-pad-x) 0;
    min-block-size: var(--amc-control);
  }
  .info-text {
    flex: 1;
    min-inline-size: 0;
    line-height: 1.4;
  }
  .info-name {
    margin: 0;
    font-size: var(--ha-font-size-l, 1.143rem);
    font-weight: var(--ha-font-weight-medium, 500);
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .info-kind {
    font-size: var(--ha-font-size-m, 1rem);
    font-weight: var(--ha-font-weight-normal, 400);
    color: var(--amc-muted);
  }
  .info-parents,
  .info-idle {
    margin: 0;
    color: var(--amc-muted);
  }
  .info-idle {
    align-self: center;
  }
  .facts {
    margin: var(--ha-space-1, 4px) 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-1, 4px) var(--ha-space-4, 16px);
  }
  .facts div {
    display: flex;
    flex-direction: column;
  }
  .facts dt {
    font-size: var(--ha-font-size-s, 0.857rem);
    color: var(--amc-muted);
  }
  .facts dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .fact-source {
    display: block;
    font-size: var(--ha-font-size-s, 0.857rem);
    color: var(--amc-muted);
  }
  .info-actions {
    flex: none;
    display: flex;
    gap: var(--ha-space-1, 4px);
  }

  .credit {
    margin: 0;
    padding: var(--ha-space-2, 8px) var(--amc-pad-x) var(--amc-pad-y);
    font-size: var(--ha-font-size-s, 0.857rem);
    line-height: 1.4;
    color: var(--amc-muted);
  }
  .credit a {
    color: inherit;
  }

  @container austria-map-card (inline-size < 360px) {
    .info {
      flex-direction: column;
    }
    .info-actions {
      align-self: flex-end;
    }
  }

  /* ── Accessibility primitives ───────────────────────────────────── */
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--amc-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  @media (forced-colors: active) {
    a:focus-visible,
    button:focus-visible,
    canvas:focus-visible {
      outline-color: CanvasText;
    }
    .layer[aria-checked="true"] .switch {
      background: Highlight;
      border-color: Highlight;
    }
    .crosshair {
      forced-color-adjust: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;console.info(`%c AUSTRIA-MAP-CARD %c ${at} `,`color:#fff;background:#c8102e;font-weight:600`,`color:#c8102e;background:#fff`);const Ai=3072,ji=()=>typeof WebGL2RenderingContext<`u`;let Mi;const Ni=()=>Mi??={columns:V,rows:530,metres:new Float32Array(V*530),peak:0};let $=class extends Me{constructor(...e){super(...e),this._config=nt({type:`custom:${I}`}),this._layers=new Set(this._config.layers),this._selection=null,this._layersOpen=!1,this._toast=!1,this._nothingHere=!1,this._revision=0,this._orientation=fr,this._canTilt=ji(),this._device=null,this._camera=null,this._loader=an({base:import.meta.url,version:at}),this._gesture=new Dr,this._raf=0,this._hassKey=``,this._paletteKey=``,this._viewKey=``,this._locationKey=``,this._watch=null,this._gl=null,this._tiltRaf=0,this._turning=!1,this._frame=()=>{this._raf=0,this._drawNow()},this._onData=()=>{this._revision+=1,this._requestDraw()},this._wheel={handleEvent:e=>{if(!(e.ctrlKey||e.metaKey)){this._toast=!0,clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>this._toast=!1,1800);return}e.preventDefault();let t=this._renderer?.size;this._camera&&t&&(this._flat?this._setCamera(Cn(this._camera,t,...this._local(e),Nr(e.deltaY))):this._setCamera(wr(this._camera,t,Nr(e.deltaY))))},passive:!1},this._onDocumentPointer=e=>{this._layersOpen&&(e.composedPath().some(e=>e instanceof HTMLElement&&(e.classList.contains(`layers`)||e.classList.contains(`layers-button`)))||this._closeLayers(!1))}}static{this.styles=ki}setConfig(e){let t=nt(e),n=this._config;this._config=t,t.layers.join()!==n.layers.join()&&(this._layers=new Set(t.layers)),t.view!==n.view&&(this._camera=this._openingCamera()),t.show_layer_control||(this._layersOpen=!1),this.isConnected&&this._syncDeviceWatch(),this._requestDraw()}getCardSize(){return 8}getGridOptions(){return{columns:12,rows:7,min_columns:6,min_rows:5}}static getStubConfig(){return{}}static getConfigElement(){return document.createElement(`${I}-editor`)}connectedCallback(){super.connectedCallback(),this._unsubscribe=this._loader.subscribe(this._onData),document.addEventListener(`pointerdown`,this._onDocumentPointer,!0),this._syncDeviceWatch(),this._renderer&&(this._observe(),this.updateComplete.then(()=>this._refreshPalette(!0)))}disconnectedCallback(){super.disconnectedCallback(),this._unsubscribe?.(),document.removeEventListener(`pointerdown`,this._onDocumentPointer,!0),this._resizeObserver?.disconnect(),cancelAnimationFrame(this._raf),this._raf=0,clearTimeout(this._toastTimer),this._gesture.reset(),this._stopDeviceWatch(),cancelAnimationFrame(this._tiltRaf),this._tiltRaf=0}shouldUpdate(e){return e.size===1&&e.has(`hass`)?this._hassFingerprint()!==this._hassKey||this._currentLocationKey()!==this._locationKey:!0}firstUpdated(){let e=this._canvas;if(e){try{this._renderer=new Oi(e,this._loader.store,()=>new Path2D)}catch(e){console.error(`[austria-map-card] no canvas to draw on`,e);return}this._observe(),this._loader.request([`base`])}}updated(e){let t=e.has(`hass`)&&this._hassFingerprint()!==this._hassKey;e.has(`hass`)&&(this._hassKey=this._hassFingerprint()),this._refreshPalette(!1),t&&requestAnimationFrame(()=>this._refreshPalette(!0));let n=this._currentLocationKey();n!==this._locationKey&&(this._locationKey=n,this._requestDraw())}_observe(){let e=this._stage;e&&(this._resizeObserver?.disconnect(),this._resizeObserver=new ResizeObserver(e=>this._onResize(e[0]?.contentRect)),this._resizeObserver.observe(e))}_onResize(e){let t=this._renderer;if(!e||!t)return;let n={width:Math.floor(e.width),height:Math.floor(e.height)};if(n.width<=0||n.height<=0)return;let r=t.size;(n.width!==r.width||n.height!==r.height)&&(t.resize(n.width,n.height,window.devicePixelRatio),this._gl&&this._reliefCanvas&&this._gl.resize(this._reliefCanvas,n.width,n.height,window.devicePixelRatio),t.hasPalette||this._refreshPalette(!0),this._camera=this._camera!==null&&r.width>0?Tn(this._camera,r,n):this._openingCamera(),this._drawNow())}_isDark(){return this.hass?.themes?.darkMode??window.matchMedia(`(prefers-color-scheme: dark)`).matches}_hassFingerprint(){let e=this.hass;return[kt(e),e?.themes?.darkMode,e?.themes?.theme,e?.selectedTheme?.theme].join(`|`)}_refreshPalette(e){let t=this._renderer,n=this._probe;if(!t||!n)return;let r=this._hassFingerprint();if(!e&&r===this._paletteKey&&t.hasPalette)return;let i=Kr(n,this._isDark());i===null?this._paletteKey=``:(this._paletteKey=r,this._palette=Wr(i),t.setPalette(this._palette),this._requestDraw())}_currentLocationKey(){let e=this._config;return e.show_location?dr(this.hass,e.location,this._device):``}_here(){let e=this._config;if(!e.show_location)return null;let t=ur(this.hass,e.location,this._device);return t===null?null:hn(t.latitude,t.longitude)}_syncDeviceWatch(){if(!(this._config.show_location&&this._config.location===`device`)){this._stopDeviceWatch();return}let e=typeof navigator>`u`?void 0:navigator.geolocation;this._watch===null&&e!==void 0&&(this._watch=e.watchPosition(e=>this._device={latitude:e.coords.latitude,longitude:e.coords.longitude},e=>console.warn(`[austria-map-card] no device position:`,e.message),{maximumAge:6e4,timeout:3e4}))}_stopDeviceWatch(){this._watch!==null&&(navigator.geolocation?.clearWatch(this._watch),this._watch=null)}_goHere(){let e=this._here(),t=this._renderer?.size;if(e===null||!t)return;let[n,r]=e;this._setCamera(yn([n-14,r-14,n+14,r+14],t,0))}_openingCamera(){let e=this._renderer?.size;if(!e||e.width===0)return null;let t=this._config.view;if(t===`austria`)return vn(e);let n=this._loader.store.overview;return n===void 0?null:yn(n.index.box(Ge.indexOf(t)),e,16)}_setCamera(e){this._camera=e,this._requestDraw()}_zoomBy(e){let t=this._renderer?.size;this._camera&&t&&(this._flat?this._setCamera(Cn(this._camera,t,t.width/2,t.height/2,e)):this._setCamera(wr(this._camera,t,e)))}_resetView(){let e=this._openingCamera();this._stopTilt(),this._orientation=fr,e&&this._setCamera(e)}get _flat(){return vr(this._orientation)||!this._canTilt}_relief(){if(this._gl!==null||!this._canTilt)return this._gl;let e=this._reliefCanvas,t=this._renderer?.size;return!e||!t?null:(this._gl=Qr.create(e),this._gl===null?(this._canTilt=!1,this._orientation=fr,null):(this._gl.resize(e,t.width,t.height,window.devicePixelRatio),this._gl))}_setPose(e){let t=this._renderer?.size;if(!t)return;let{orientation:n}=e;n.pitch===0&&Math.abs(n.bearing)<.05&&(n=fr),this._orientation=n,this._setCamera(vr(n)?_n(e.camera,t):Tr(e.camera,t))}_orientBy(e,t){this._camera&&this._canTilt&&(this._stopTilt(),this._setPose({camera:this._camera,orientation:br(this._orientation,e,t)}))}_stopTilt(){cancelAnimationFrame(this._tiltRaf),this._tiltRaf=0}_tiltTo(e){this._stopTilt();let t=this._orientation,n=yr(e.bearing-t.bearing);if(window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches){this._camera&&this._setPose({camera:this._camera,orientation:e});return}let r=performance.now(),i=a=>{let o=Math.min(1,(a-r)/450),s=o<.5?2*o*o:1-(-2*o+2)**2/2,c=this._camera;c&&(this._setPose({camera:c,orientation:o>=1?e:{pitch:t.pitch+(e.pitch-t.pitch)*s,bearing:yr(t.bearing+n*s)}}),this._tiltRaf=o<1?requestAnimationFrame(i):0)};this._tiltRaf=requestAnimationFrame(i)}_toggleTilt(){this._tiltTo(this._orientation.pitch>0?fr:{pitch:hr,bearing:this._orientation.bearing})}_faceNorth(){this._tiltTo({pitch:this._orientation.pitch,bearing:0})}_drapeLayers(){return new Set(this._layers.has(`terrain`)?[`terrain`]:[])}_updateDrape(e){let t=this._palette;if(t===void 0)return;if(this._drape===void 0){let e=document.createElement(`canvas`);this._drape={canvas:e,renderer:new Oi(e,this._loader.store,()=>new Path2D),key:``},this._drape.renderer.resize(Ai,1628,1,Ai)}let n=this._drape,r=this._drapeLayers(),i=this._selection?.kind===`city`||this._selection?.kind===`peak`?null:this._selection,a=[this._loader.store.revision,[...r].join(),this._paletteKey,JSON.stringify(i)].join(`|`);a!==n.key&&(n.key=a,n.renderer.setPalette(t),n.renderer.draw({camera:{x:V/2,y:265,k:Ai/V},layers:r,showLabels:!1,selection:i,here:null,fillsOnly:!0}),e.setDrape(n.canvas,a))}_state(e){return{camera:e,layers:this._layers,showLabels:this._config.show_labels,selection:this._selection,here:this._here()}}_requestDraw(){!this._raf&&this.isConnected&&(this._raf=requestAnimationFrame(this._frame))}_drawNow(){let e=this._renderer;if(!e)return;this._camera??=this._openingCamera();let t=this._camera??vn(e.size);this._loader.request(ar(this._layers,t.k));let n=this._flat?null:this._relief();if(n===null||n.lost)this._reliefCanvas&&(this._reliefCanvas.hidden=!0),n?.lost&&(this._canTilt=!1,this._orientation=fr),e.draw(this._state(t));else{this._reliefCanvas&&(this._reliefCanvas.hidden=!1),this._loader.request([`relief`,...ar(this._drapeLayers(),Ai/V)]);let r=this._loader.store;n.setRelief(r.relief??Ni()),this._updateDrape(n);let i=new Sr(t,this._orientation,e.size,r.relief);n.draw(i,this._palette?ni(r,this._layers,t.k,this._selection,this._palette):[]),e.drawTilted(this._state(t),i)}this._syncView(t,e.size)}_syncView(e,t){let n=gn(e,t),r=[n<=1.0001,n>=39.9999,...G.map(t=>e.k>=t.minScale)].join();r!==this._viewKey&&(this._viewKey=r,this._revision+=1)}_local(e){let t=e.currentTarget.getBoundingClientRect();return[e.clientX-t.left,e.clientY-t.top]}_onPointerDown(e){let t=e.currentTarget;t.setPointerCapture?.(e.pointerId),this._stopTilt(),this._turning=this._canTilt&&(e.button===2||e.shiftKey),this._gesture.down(e.pointerId,...this._local(e)),t.classList.add(`dragging`)}_onPointerMove(e){let t=this._renderer?.size;if(!this._camera||!t)return;if(this._canTilt){let n={camera:this._camera,orientation:this._orientation},r=this._gesture.movePose(e.pointerId,...this._local(e),n,t,this._turning);r!==null&&(r.camera!==n.camera||r.orientation!==n.orientation)&&this._setPose(r);return}let n=this._gesture.move(e.pointerId,...this._local(e),this._camera,t);n!==null&&n!==this._camera&&this._setCamera(n)}_onContextMenu(e){this._canTilt&&e.preventDefault()}_onPointerUp(e){let[t,n]=this._local(e),r=this._gesture.up(e.pointerId,e.type!==`pointerup`,performance.now());this._gesture.active||e.currentTarget.classList.remove(`dragging`);let i=this._renderer;if(i&&this._camera){if(r===`double-tap`&&!this._flat){let e=new Sr(this._camera,this._orientation,i.size,this._loader.store.relief).pick(t,n,this._loader.store.relief),r=e===null?this._camera:{...this._camera,x:e[0],y:e[1]};this._setCamera(wr(r,i.size,q*q))}else r===`double-tap`?this._setCamera(Cn(this._camera,i.size,t,n,q*q)):r===`tap`&&this._select(i.hit(this._state(this._camera),t,n))}}_onKeyDown(e){if(e.ctrlKey||e.metaKey||e.altKey)return;let t=Mr(e.key,e.shiftKey,this._canTilt),n=this._renderer;if(!t||!n||!this._camera)return;e.preventDefault();let r=n.size;if(t.kind===`pan`)this._setCamera(this._flat?wn(this._camera,r,t.dx,t.dy):Cr(this._camera,this._orientation,r,t.dx,t.dy));else if(t.kind===`orient`)this._orientBy(t.pitch,t.bearing);else if(t.kind===`zoom`)this._zoomBy(t.factor);else if(t.kind===`reset`)this._resetView();else{this._drawNow();let e=n.hit(this._state(this._camera),r.width/2,r.height/2);this._select(e),this._nothingHere=e===null}}_select(e){this._selection=e,this._nothingHere=!1,e?.kind===`city`&&this._loader.request([`borders`]),e?.kind===`peak`&&this._loader.request([`borders`,`gemeinden`]),this._requestDraw()}_zoomToSelection(){let e=this._renderer;if(!e||this._selection===null)return;let t=e.boxOf(this._selection);t&&this._setCamera(yn(t,e.size,28))}_toggleLayer(e){let t=new Set(this._layers);t.delete(e)||t.add(e),this._layers=t,this._requestDraw()}_layerNote(e){if(!this._layers.has(e.id))return null;let t=this._camera?.k??0;if(t<e.minScale)return`zoom`;let n=[`base`,...e.chunks(t)].map(e=>this._loader.state(e));return n.includes(`failed`)||n.includes(`outdated`)?`failed`:n.includes(`loading`)?`loading`:null}_closeLayers(e){this._layersOpen&&(this._layersOpen=!1,e&&this._layersButton?.focus())}_onLayersKeyDown(e){e.key===`Escape`&&(e.stopPropagation(),this._closeLayers(!0))}_t(e,t){return Ot(e,kt(this.hass),t)}render(){this._revision;let e=this._config,t=this._loader.state(`base`)===`ready`,n=this._renderer?.size,r=this._camera&&n?gn(this._camera,n):1;return k`
      <ha-card>
        <span class="probe" aria-hidden="true"></span>
        ${e.title?k`<h2 class="title">${e.title}</h2>`:j}
        <div class="stage">
          <canvas
            class=${Ue({map:!0,zoomed:r>1.0001,tilted:!this._flat})}
            tabindex="0"
            role="application"
            aria-label=${this._t(`card.map_label`)}
            aria-describedby="map-help"
            @pointerdown=${this._onPointerDown}
            @pointermove=${this._onPointerMove}
            @pointerup=${this._onPointerUp}
            @pointercancel=${this._onPointerUp}
            @wheel=${this._wheel}
            @keydown=${this._onKeyDown}
            @contextmenu=${this._onContextMenu}
          ></canvas>
          ${this._canTilt?k`<canvas class="relief" aria-hidden="true" hidden></canvas>`:j}
          <span class="crosshair" aria-hidden="true"></span>
          <span id="map-help" class="sr-only"
            >${this._t(`card.map_help`)}${this._canTilt?` ${this._t(`card.map_help_tilt`)}`:``}</span
          >
          ${t?j:this._renderLoading()} ${this._renderReliefLoading()} ${this._renderToolbar(r)}
          ${this._layersOpen&&e.show_layer_control?this._renderLayers():j} ${this._renderNotice()}
        </div>
        ${this._renderInfo()} ${this._renderCredit()}
      </ha-card>
    `}_renderLoading(){let e=this._loader.state(`base`);return e===`failed`||e===`outdated`?j:k`<div class="loading" role="status">${this._t(`card.loading`)}</div>`}_renderReliefLoading(){return this._flat||this._loader.state(`relief`)!==`loading`?j:k`<div class="toast" role="status">${this._t(`card.loading_relief`)}</div>`}_tool(e,t,n,r=!1){return k`
      <button type="button" class="tool" aria-label=${e} title=${e} ?disabled=${r} @click=${n}>
        <ha-icon icon=${t} aria-hidden="true"></ha-icon>
      </button>
    `}_renderToolbar(e){let t=this._t(`controls.layers`);return k`
      <div class="toolbar" role="group" aria-label=${this._t(`controls.group`)}>
        ${this._config.show_layer_control?k`
              <button
                type="button"
                class="tool layers-button"
                aria-label=${t}
                title=${t}
                aria-expanded=${this._layersOpen?`true`:`false`}
                aria-controls="layers"
                @click=${()=>this._layersOpen=!this._layersOpen}
              >
                <ha-icon icon="mdi:layers-outline" aria-hidden="true"></ha-icon>
              </button>
              <span class="tool-gap"></span>
            `:j}
        ${this._tool(this._t(`controls.zoom_in`),`mdi:plus`,()=>this._zoomBy(q),e>=39.9999)}
        ${this._tool(this._t(`controls.zoom_out`),`mdi:minus`,()=>this._zoomBy(1/q),e<=1.0001)}
        ${this._tool(this._t(`controls.reset`),`mdi:fit-to-screen-outline`,()=>this._resetView())}
        ${this._canTilt?k`
              <button
                type="button"
                class="tool"
                aria-label=${this._t(`controls.tilt`)}
                title=${this._t(`controls.tilt`)}
                aria-pressed=${this._orientation.pitch>0?`true`:`false`}
                @click=${()=>this._toggleTilt()}
              >
                <ha-icon icon="mdi:rotate-3d-variant" aria-hidden="true"></ha-icon>
              </button>
            `:j}
        ${this._canTilt&&this._orientation.bearing!==0?k`
              <button
                type="button"
                class="tool compass"
                aria-label=${this._t(`controls.north`)}
                title=${this._t(`controls.north`)}
                @click=${()=>this._faceNorth()}
              >
                <ha-icon
                  icon="mdi:navigation"
                  aria-hidden="true"
                  style=${`transform: rotate(${-this._orientation.bearing}rad)`}
                ></ha-icon>
              </button>
            `:j}
        ${this._config.show_location?this._tool(this._t(`controls.my_location`),`mdi:crosshairs-gps`,()=>this._goHere(),this._here()===null):j}
      </div>
    `}_renderLayers(){return k`
      <div id="layers" class="layers" role="group" aria-labelledby="layers-title" @keydown=${this._onLayersKeyDown}>
        <h3 id="layers-title">${this._t(`controls.layers`)}</h3>
        ${G.map(e=>{let t=this._layerNote(e);return k`
            <button
              type="button"
              class="layer"
              role="switch"
              aria-checked=${this._layers.has(e.id)?`true`:`false`}
              @click=${()=>this._toggleLayer(e.id)}
            >
              <ha-icon icon=${e.icon} aria-hidden="true"></ha-icon>
              <span class="layer-text">
                <span>${this._t(`layers.${e.id}`)}</span>
                ${t?k`<span class="layer-note">${this._t(`layer_notes.${t}`)}</span>`:j}
              </span>
              <span class="switch" aria-hidden="true"></span>
            </button>
          `})}
      </div>
    `}_renderNotice(){let e=this._loader;return e.outdated?k`
        <div class="notice" role="alert">
          <span>${this._t(`card.outdated`)}</span>
          <button type="button" class="text" @click=${()=>window.location.reload()}>${this._t(`card.reload`)}</button>
        </div>
      `:e.failed.length>0?k`
        <div class="notice" role="alert">
          <span>${this._t(`card.load_failed`)}</span>
          <button type="button" class="text" @click=${()=>e.retry()}>${this._t(`card.retry`)}</button>
        </div>
      `:this._toast?k`<div class="toast" role="status">${this._t(`card.zoom_hint`)}</div>`:j}_number(e){try{return new Intl.NumberFormat(kt(this.hass)).format(e)}catch{return String(e)}}_renderFacts(e){return e.facts.length===0?j:k`
      <dl class="facts">
        ${e.facts.map(e=>k`
            <div>
              <dt>${this._t(e.label)}</dt>
              <dd>
                ${this._number(e.value)}${e.format===`metres`?` m`:``}
                ${e.source?k`<span class="fact-source"
                      >${this._t(`facts.source`,{holder:e.source.holder,stand:e.source.stand})}</span
                    >`:j}
              </dd>
            </div>
          `)}
      </dl>
    `}_renderInfo(){let e=this._selection===null?null:Pt(this._loader.store,this._selection);return k`
      <section class="info" aria-label=${this._t(`card.info_label`)}>
        <div class="info-text" aria-live="polite" aria-atomic="true">
          ${e===null?k`<p class="info-idle">${this._t(this._nothingHere?`card.nothing_here`:`card.info_idle`)}</p>`:k`
                <p class="info-name">
                  <span lang="de">${e.name}</span>
                  <span class="info-kind">${this._t(e.kind)}</span>
                </p>
                ${e.parents.length>0?k`<p class="info-parents" lang="de">${[...new Set(e.parents)].filter(t=>t!==e.name).join(` · `)}</p>`:j}
                ${this._renderFacts(e)}
              `}
        </div>
        ${e===null?j:k`
              <div class="info-actions">
                <button type="button" class="text" @click=${this._zoomToSelection}>${this._t(`controls.zoom_here`)}</button>
                <button
                  type="button"
                  class="icon"
                  aria-label=${this._t(`controls.clear`)}
                  title=${this._t(`controls.clear`)}
                  @click=${()=>this._select(null)}
                >
                  <ha-icon icon="mdi:close" aria-hidden="true"></ha-icon>
                </button>
              </div>
            `}
      </section>
    `}_renderCredit(){let e=this._loader.store.sources();if(e.length===0)return j;let t=[...new Set(e.map(e=>e.holder))].join(`, `),n=e[0]?.licence??``;return k`
      <p class="credit">
        ${this._t(`card.credit`,{holders:t})} ·
        <a href=${`https://creativecommons.org/licenses/by/4.0/`} target="_blank" rel="noopener noreferrer">${n}</a>
      </p>
    `}};L([Le({attribute:!1})],$.prototype,`hass`,void 0),L([P()],$.prototype,`_config`,void 0),L([P()],$.prototype,`_layers`,void 0),L([P()],$.prototype,`_selection`,void 0),L([P()],$.prototype,`_layersOpen`,void 0),L([P()],$.prototype,`_toast`,void 0),L([P()],$.prototype,`_nothingHere`,void 0),L([P()],$.prototype,`_revision`,void 0),L([P()],$.prototype,`_orientation`,void 0),L([P()],$.prototype,`_canTilt`,void 0),L([P()],$.prototype,`_device`,void 0),L([ze(`canvas.map`)],$.prototype,`_canvas`,void 0),L([ze(`canvas.relief`)],$.prototype,`_reliefCanvas`,void 0),L([ze(`.stage`)],$.prototype,`_stage`,void 0),L([ze(`.probe`)],$.prototype,`_probe`,void 0),L([ze(`.layers-button`)],$.prototype,`_layersButton`,void 0),$=L([Pe(I)],$);const Pi=window;Pi.customCards??=[],Pi.customCards.some(e=>e.type===`austria-map-card`)||Pi.customCards.push({type:I,name:`Austria Map Card`,description:`A zoomable map of Austria with terrain, rivers, borders and towns.`,preview:!0,documentationURL:`https://github.com/rolandzeiner/austria-map-card`});export{$ as AustriaMapCard};