# 中间"景区分布与口碑"地图要用的数据：把下载的张家界市 geojson 边界转成 js 文件
#   原因和气温、空气数据一样：双击打开 html 时（file:// 协议），浏览器不允许网页读取本地文件，
#   转成 "var zjjGeoJson = {...};" 这样的 js 文件，用 <script> 标签引入就没有这个限制
import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界市.geojson"
OUT = BASE_DIR + r"\dashboard\data\zjjGeo.js"

# 1. 读入下载的 geojson（阿里云 DataV GeoAtlas，勾了"包含子区域"）
geo = json.load(open(SRC, encoding="utf-8"))

# 2. 写成 js：直接把整个 geojson 内容塞进一个变量
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 张家界市地图边界（永定区/武陵源区/慈利县/桑植县），数据来自阿里云 DataV GeoAtlas\n")
    f.write("// 由 data_processing/06_zjj_geo.py 从 data/张家界市.geojson 转换生成\n")
    f.write("var zjjGeoJson = " + json.dumps(geo, ensure_ascii=False) + ";\n")

print("区域数:", len(geo["features"]))
for ft in geo["features"]:
    print(" -", ft["properties"]["name"], ft["properties"]["adcode"])
print("已保存:", OUT)
