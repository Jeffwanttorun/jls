// Browser-only test fixture. Does not load a provider, key or actual map tiles.
(() => {
 const state={maps:[],geometries:[],markerStyles:{},polylineGeometries:[],polylineStyles:[],fitBoundsCount:0,fitBoundsHistory:[]};window.__mapTest=state;
 class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng;}getLat(){return this.lat;}getLng(){return this.lng;}}
 class LatLngBounds{constructor(sw,ne){this.points=[sw,ne];}extend(point){this.points.push(point);return this;}}
 class Map{
  constructor(el,options){this.el=el;this.zoom=options.zoom;this.center=options.center;this.baseMap=options.baseMap;this.handlers={};state.maps.push(this);
   el.style.background='#e3ede7';const legend=document.createElement('p');legend.textContent='测试环境：腾讯 SDK 事件替身，无真实底图';legend.style.padding='16px';el.appendChild(legend);
   el.addEventListener('click',e=>this.handlers.click?.({latLng:new LatLng(e.clientX-el.getBoundingClientRect().left>150?27.79:27.77,117.98)}));
  }
  on(event,fn){this.handlers[event]=fn;}getZoom(){return this.zoom;}setZoom(zoom){this.zoom=zoom;this.handlers.zoom_changed?.({});}setCenter(c){this.center=c;}getCenter(){return this.center;}setBaseMap(value){this.baseMap=value;}fitBounds(bounds){this.bounds=bounds;state.fitBoundsCount+=1;state.fitBoundsHistory.push({pointCount:bounds.points?.length||0});}destroy(){}
 }
 class MarkerStyle{constructor(options){Object.assign(this,options);}}
 class MultiMarker{constructor(options){this.handlers={};state.marker=this;state.markerStyles=options.styles;}on(event,fn){this.handlers[event]=fn;}setGeometries(geometries){state.geometries=geometries;}setMap(){}}
 class PolylineStyle{constructor(options){Object.assign(this,options);state.polylineStyles.push(options);}}
 class MultiPolyline{constructor(options){this.options=options;state.polylineGeometries=options.geometries;state.polyline=options;}setMap(){}}
 window.TMap={Map,LatLng,LatLngBounds,MultiMarker,MarkerStyle,MultiPolyline,PolylineStyle};
})();
