/**
 * AMap.marker.plugin v1.1.0
 * 坐标点关系，Y轴：纬度 latitude  X轴：经度 longitude
 * 同视口坐标关系，x 增加 经度增加；Y 增加 纬度减小
 */

import { defaultsDeep } from "lodash";
import { fromEvent } from "rxjs";
import { map, auditTime, debounceTime, throttleTime } from "rxjs/operators";

export const getSVGSrc = (color: string) => {
  return `data:image/svg+xml;charset=UTF-8,%3Csvg%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2245%22%20height%3D%2260%22%20%3E%3Cg%20%3E%3Cpath%20stroke-width%3D%220%22%20fill%3D%22${encodeURIComponent(
    color
  )}%22%20d%3D%22M22.5%2C0C10.043%2C0%2C0%2C9.75%2C0%2C21.75C0%2C41.125%2C22.5%2C60%2C22.5%2C60s22.5%2C-19.25%2C22.5%2C-38.25C45%2C9.75%2C34.958%2C0%2C22.5%2C0z%22%20%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E`;
};

let AMap: any; // 高德地图全局对象
const doc: Document = document;
const win: Window = window;
const $: {
  (selector: string, isAll?: boolean | undefined):
    | NodeListOf<Element>
    | null
    | Element;
} = (e: string, isAll) =>
  isAll ? doc.querySelectorAll(e) : doc.querySelector(e);

interface Options {
  [key: string]: any;

  instance?: any; // map 实例
  startBtn?: string; // 圈选开始按钮
  map?: string; // map 结构 同canvas 大小
  zIndex?: number; // z-index;
  layerClassName?: string;
  borderColor?: string;
  borderSize?: number;
  range?: string; // 监听DOM范围
  hide?: { (layer: any, rangeEle: any): void }; // 弹层消失；
  show?: { (layer: any, rangeEle: any): void }; // 强层出现；
  layerOnMount?: (layer: any, rangeEle: any) => void; // 弹层初始化；
  move?: () => void; // 鼠标移动事件
  selected?: (markers: any[], context: any) => void;
  destroy?: () => void; // 销毁插件
}

const DEFAULTS: Options = {
  instance: window, // 高德地图实例所挂载对象
  startBtn: ".multiSelBtn",
  map: "#mapBox", // map 结构 同canvas 大小
  zIndex: 9999,
  borderColor: "red",
  borderSize: 2,
  layerClassName: "layer-marker",
  lineClassName: "multi-select-line",
  range: "#mapBox",
  cache: {
    isNoop: true, // 是否是空操作
    markers: [], // 所有markers
    markerData: [], // 所有额外数据
    evt: null, //
    isShow: false, // layer层是否展示
    isSelect: false, // 是否在选中中
    selected: [], // 所有被选中的数据
    unsubscribe: [] //销毁所有实例
  },
  // eslint-disable-next-line
  hide: function(layer: any, rangeEle: any) {
    //console.log('hide', layer, rangeEle)
  }, // 弹层消失；
  // eslint-disable-next-line
  show: function(layer: any, rangeEle: any) {
    //console.log('show', layer, rangeEle)
  }, // 强层出现；
  // eslint-disable-next-line
  layerOnMount: function(layer: any, rangeEle: any) {
    //console.log('layerOnMount', layer, rangeEle)
  }, // 弹层初始化；
  // eslint-disable-next-line
  move: function() {
    //console.log('move')
  }, // 鼠标移动事件
  // eslint-disable-next-line
  selected: function(markers: any[], context: any) {
    //console.log('selected', markers)
  },
  // eslint-disable-next-line
  destroy: function() {
    // console.log('destroyed')
  }
};

let _h: any;

export default class AMapMarkerPlugin {
  options: any;
  unsubscribe: any[] = [];

  constructor(opt?: Options) {
    this.options = defaultsDeep(opt, DEFAULTS, {});
  }

  init() {
    doc.addEventListener("map", (_h = this.handleMapEvent.bind(this)), false);
    return this;
  }

  bindEvent() {
    const cache = this.options.cache;
    let isInit: boolean = false; // 是不是初始化layer
    const options = this.options;
    const _this = this;

    const unsubscribe1 = fromEvent(window, "resize")
      .pipe(debounceTime(500))
      .subscribe(() => {
        this.resetLayer();
      });
    //初始化layer
    cache.isShow = false;
    const startBtn: any = $(options.startBtn, true);
    const unsubscribe2 = fromEvent(startBtn, "click").subscribe(e => {
      if (e) {
        cache.isSelect = true;
        cache.isShow = true;
        cache.ele.style.display = "block";
        options.show(cache.ele, cache.line);
      }
      cache.boxBcr = cache.boxEle.getBoundingClientRect();
    });

    // 取消layer
    const unClick = fromEvent(cache.ele, "click")
      .pipe()
      .subscribe(() => {
        if (!isInit) {
          this.resets();
          //unClick.unsubscribe();
        }
        isInit = false;
      });

    // 鼠标
    const unsubscribe3 = fromEvent(doc, "mousedown")
      .pipe(
        throttleTime(10),
        map((e: any) => {
          return cache.isSelect ? e : null;
        })
      )
      .subscribe(e => {
        if (e) {
          cache.xStart = e.clientX;
          cache.yStart = e.clientY;
          isInit = true;
          const unMove = fromEvent(doc, "mousemove")
            .pipe(auditTime(50))
            .subscribe((e: any) => {
              cache.xEnd = e.clientX;
              cache.yEnd = e.clientY;
              const width = Math.abs(cache.xStart - e.clientX);
              const height = Math.abs(cache.yStart - e.clientY);
              cache.line.style.display = "none";
              cache.line.style.width = `${width}px`;
              cache.line.style.height = `${height}px`;
              cache.line.style.top = `${Math.min(cache.yStart, e.clientY) -
                cache.boxBcr.top}px`;
              cache.line.style.left = `${Math.min(cache.xStart, e.clientX) -
                cache.boxBcr.left}px`;
              cache.line.style.display = "block";
              options.move();
            });
          // 监听鼠标完成
          const unUp = fromEvent(doc, "mouseup")
            .pipe(
              throttleTime(1500),
              map((e: any) => {
                return e!.ctrlKey && e!.altKey ? e : false;
              })
            )
            .subscribe(() => {
              const bcr = cache.line.getBoundingClientRect();
              const boxBcr = cache.boxBcr;
              cache.range = {
                left: bcr.left - boxBcr.left,
                right: bcr.right - boxBcr.left,
                top: bcr.top - boxBcr.top,
                bottom: bcr.bottom - boxBcr.top
              };
              const result = this.findMarker();
              // 记录所有选中marker
              cache.selected.splice(0, 0, ...result);
              unUp.unsubscribe();
              unMove.unsubscribe();
              setTimeout(() => options.selected(cache.selected, _this), 100);
            });
        }
      });

    this.unsubscribe.push(unClick, unsubscribe1, unsubscribe2, unsubscribe3);
  }

  handleMapEvent(this: any, evt: any) {
    switch (evt.data) {
      case "ready":
        AMap = (win as any).AMap; // 高德地图全局对象
        this.initStyle();
        this.bindEvent();
        break;
      case "markerUpdate":
        this.updateMarkers();
        break;
    }
  }

  destroy(this: any, isAll?: boolean) {
    for (const v of this.unsubscribe) {
      v.unsubscribe();
    }
    this.unsubscribe = [];
    doc.removeEventListener("map", _h);
    const ele: any = this.options.cache?.ele;
    ele.parentNode?.removeChild(ele);
    this.options?.destroy();
    //this.options = null;
  }

  updateMarkers() {
    const temp = [];
    const cache = this.options.cache;
    const mapInstance = this.options.instance;
    const markers = mapInstance.map
      .getAllOverlays()
      .filter((v: any) => v.CLASS_NAME === "AMap.LabelMarker");
    for (const v of markers) {
      const data: any = v.getExtData();
      data && temp.push(data);
    }
    cache.markers = markers;
    cache.markerData = temp;
  }

  resetLayer() {
    const cache = this.options.cache;
    const bcr = cache.boxEle!.getBoundingClientRect();
    cache.boxBcr = bcr;
    cache.ele.style.left = bcr.left + "px";
    cache.ele.style.top = bcr.top + "px";
    cache.ele.style.width = bcr.width + "px";
    cache.ele.style.height = bcr.height + "px";
  }

  initStyle() {
    const { map, zIndex, layerClassName, lineClassName } = this.options;
    const options = this.options;
    const cache: any = options.cache;
    const boxEle = $(<string>map);
    const bcr = (boxEle as any).getBoundingClientRect();
    const ele = doc.createElement("div");
    ele.className = layerClassName as string;
    ele.style.cssText = `
        width:${Math.ceil(bcr.width)}px;
        height:${bcr.height}px;
        position:absolute;
        top:${bcr.top}px;
        left:${bcr.left}px;
        z-index:${zIndex};
        display:none;
        `;
    const bg = doc.createElement("div");
    bg.style.cssText = `
        position:absolute;
        z-index:0;
        top:0;
        right:0;
        bottom:0;
        left:0;
        background-color:rgba(0,0,0,0.2);
         
        `;
    ele.appendChild(bg);
    cache.boxEle = boxEle;
    cache.ele = ele;
    const temp = doc.createElement("div");
    temp.className = lineClassName;
    temp.style.cssText = `
        display:none;
        position:absolute;
        z-index:3;
        left:0;top:0; 
        border:${options.borderSize}px ${options.borderColor} dashed`;
    cache.line = temp;
    ele.appendChild(temp);
    ($("body") as any).appendChild(ele);
    this.options.layerOnMount(ele, temp);
  }

  findMarker() {
    const result = [];
    const cache = this.options.cache;
    const range = cache.range;
    const markerData = cache.markerData;
    const { lat: latMin, lng: lngMin } = this.transform(range.left, range.top);
    const { lat: latMax, lng: lngMax } = this.transform(
      range.right,
      range.bottom
    );
    // console.log(latMin, latMax, lngMin, lngMax);
    for (let len = markerData.length; len--; ) {
      const item: any = markerData[len];
      const lat = item.lat;
      const lng = item.lng;
      if (lat > latMax && lat < latMin && lng > lngMin && lng < lngMax) {
        result.push(cache.markers[len]);
      }
    }
    return result;
  }

  transform(this: any, x: number, y: number) {
    return this.options.instance.map.containerToLngLat(new AMap.Pixel(x, y)); // 获得 LngLat 对象
  }

  getAllMarkers() {
    return this.options.instance.map
      .getAllOverlays()
      .filter((v: any) => v.CLASS_NAME === "AMap.LabelMarker");
  }

  // 重置
  resets() {
    const cache = this.options.cache;
    cache.isSelect = false;
    setTimeout(() => {
      cache.ele.style.display = "none";
      cache.line.style.display = "none";
    }, 10);

    cache.isShow = false;

    if (cache.selected.length < 1) {
      return;
    }
    for (const v of cache.selected) {
      const data = v.getExtData();
      v.setText({ content: "" });
      v.setIcon({
        image: getSVGSrc(data.color)
      });
    }
    cache.selected = [];
    this.options.hide(cache.ele, cache.line);
  }
}
export { AMapMarkerPlugin };
export const mapReadyEvent: any = new Event("map", {
  bubbles: false,
  cancelable: false
});
