/**
 * 地图 marker 多重选择
 */
import { AMapMarkerPlugin, getSVGSrc } from "./AMap.marker.plugin";
import { defaultsDeep } from "lodash";
import Tools from "@/mixin";
const tools = new Tools();

const doc: Document = document;

let instanceTemp: any;

interface Options {
  [key: string]: any;

  map?: string; // map 结构 同canvas 大小
  zIndex?: number; // z-index;
  layerClassName?: string;
  range?: string; // 监听DOM范围
}

const DEFAULTS: Options = {
  map: "#map", // map 结构 同canvas 大小
  zIndex: 9999,
  layerClassName: "layer-marker",
  lineClassName: "multi-select-line",
  range: ".amap-maps",
  cache: {}
};

export default class MultiSelect {
  options: Options;
  cache: { [key: string]: any } = {
    isNoop: true, // 是否是空操作
    markers: [], // 所有markers
    markerData: [], // 所有额外数据
    evt: null, //
    selected: [] // 所有被选中的数据
  };

  constructor(opt?: Options) {
    this.options = defaultsDeep(opt, DEFAULTS, {});
  }

  init() {
    const _this = this;
    const cache = this.options.cache;
    cache.evt = new Event("markerSelected", {
      bubbles: false,
      cancelable: false
    });
    let _h: any;
    instanceTemp = new AMapMarkerPlugin(
      Object.assign({}, this.options, {
        instance: window,
        selected: function(markers: any, context: any) {
          _this.setTempMarker(markers);
          if (markers.length > 0) {
            _h && clearTimeout(_h); //todo keep-alive 消毁
            _h = setTimeout(() => {
              _this.updateLine(markers.reverse(), context);
            }, 300);
            return;
          }
          context.resets();
        }
      })
    ).init();
    return this;
  }

  setTempMarker(list: any[]) {
    for (const v of list) {
      v.setText({ content: "S" });
      v.setIcon({
        image: getSVGSrc("#000")
      });
    }
  }

  updateLine(list: any[], context: any) {
    const temp: any[] = [];
    const cache = this.options.cache;
    for (const v of list) {
      temp.push(v.getExtData());
    }

    tools
      .confirm("确认要选择这些点位吗？")
      .then(() => {
        cache.evt.data = temp.slice().reverse(); // marker 的顺序
        cache.evt.markers = list; // marker 的顺序
        doc.dispatchEvent(cache.evt);
      })
      .catch(() => {})
      .finally(() => context.resets());
  }

  getAllMarkers() {
    return instanceTemp.getAllMarkers();
  }

  destroy() {
    instanceTemp && instanceTemp.destroy();
  }
}
export { MultiSelect };
