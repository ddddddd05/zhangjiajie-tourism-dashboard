# 把"游客与旅游收入"CSV 转成网页能直接用的 JSON / JS 文件
#   表里的数值带单位文字（"3884.58万"、"248.7亿"、"暂无数据"），先清洗成纯数字再输出
#   输出两份内容一样的文件：
#     tourism.json —— 标准 JSON（用 Live Server 打开页面时可以 fetch 读取）
#     tourism.js   —— window.TOURISM_DATA = [...]，页面里用 <script> 引入，双击打开也能用
import json
import os

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
DATA_DIR = os.path.join(BASE_DIR, "data")  # CSV 在这里
OUT_DIR = os.path.join(BASE_DIR, "dashboard", "data")  # 输出到页面用的 data 文件夹

# ==================== 一、读入 CSV ====================
SRC = os.path.join(DATA_DIR, "张家界-游客与旅游收入-2014_2023.csv")
if not os.path.exists(SRC):
    raise FileNotFoundError("没找到 " + SRC + "，请检查文件名")
print("读取文件:", SRC)

# 编码：先试 utf-8-sig（带或不带 BOM 的 UTF-8 都行），不行再用 gbk（Excel 另存的常见编码）
# sep=None：自动识别逗号 / 制表符分隔
try:
    df = pd.read_csv(SRC, sep=None, engine="python", encoding="utf-8-sig", dtype=str)
except UnicodeDecodeError:
    df = pd.read_csv(SRC, sep=None, engine="python", encoding="gbk", dtype=str)

# ==================== 二、清洗：去掉"万/亿"，转成数字 ====================
def to_number(col):
    # 取出字符串里的数字部分（"3884.58万" -> 3884.58）；"暂无数据" 取不到数字，变成空值 NaN
    return pd.to_numeric(col.str.extract(r"(\d+\.?\d*)")[0], errors="coerce")

out = pd.DataFrame({
    "year": df["年份"].str.strip(),
    "tourists_wan": to_number(df["接待游客_万人次"]),   # 接待游客，单位：万人次
    "revenue_yi": to_number(df["旅游总收入_亿元"]),      # 旅游总收入，单位：亿元
    "inbound_wan": to_number(df["其中境外游客_万人次"]), # 境外游客，单位：万人次（2021 年无数据 -> null）
    "source": df["出处链接"].str.strip(),                # 出处链接
})
out = out.sort_values("year")

# ==================== 三、保存 ====================
# to_json 会把空值 NaN 自动写成 null；force_ascii=False 让中文不被转成 \uXXXX
json_text = out.to_json(orient="records", force_ascii=False, indent=2)

JSON_OUT = os.path.join(OUT_DIR, "tourism.json")
JS_OUT = os.path.join(OUT_DIR, "tourism.js")

with open(JSON_OUT, "w", encoding="utf-8") as f:
    f.write(json_text)

with open(JS_OUT, "w", encoding="utf-8") as f:
    f.write("// 张家界游客与旅游收入（tourists_wan/inbound_wan：万人次，revenue_yi：亿元）\n")
    f.write("window.TOURISM_DATA = " + json_text + ";\n")

print("年份范围:", out["year"].min(), "~", out["year"].max(), "（共", len(out), "行）")
print("各列空值个数:", out.isna().sum().to_dict())
print("已输出:", JSON_OUT)
print("已输出:", JS_OUT)