# 中间"客源省份"图要用的数据：评价里 IP 属地字段按省份统计条数
#   IP 属地里有"未知"（找不到位置）、境外国家/地区（日本、法国等）——这些不算进"省份排名"里，
#   境外的条数太少（加起来十几条），单独出一个"境外"小计，不逐个国家列
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\sourceProvince.js"

# 境外地区名单（中国的省份都是 2 个字起步的省/自治区/直辖市名，这些不是）
OVERSEAS = {"中国香港", "中国澳门", "中国台湾", "新加坡", "法国", "英国", "日本", "葡萄牙", "美国", "澳大利亚", "奥地利"}

review = pd.read_csv(SRC)
total = len(review)

unknown_count = int((review["IP属地"] == "未知").sum())
overseas_count = int(review["IP属地"].isin(OVERSEAS).sum())

# 只统计大陆省份（排除未知、境外），按条数从多到少排序，取前 10
province = review[~review["IP属地"].isin(OVERSEAS | {"未知"})]
counts = province["IP属地"].value_counts()
top10 = [{"name": name, "count": int(c)} for name, c in counts.head(10).items()]

# 全部省份（画中国地图要用）：echarts 中国地图按省份名字找数据，没出现过的省份不在 counts 里，
# 地图上这个省就没有颜色（自动留白），不用补 0
all_provinces = [{"name": name, "value": int(c)} for name, c in counts.items()]

# 本省（湖南）占比：客源结构里最重要的一个数字——本省游客多说明是"周边游"为主，外省多说明辐射范围广
hunan_count = int(counts.get("湖南", 0))
hunan_share = round(hunan_count / counts.sum() * 100, 1)

data = {
    "top10": top10,
    "allProvinces": all_provinces,
    "maxCount": int(counts.max()),
    "total": total,
    "unknownCount": unknown_count,
    "overseasCount": overseas_count,
    "hunanShare": hunan_share,
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 客源省份：评价 IP 属地按省份统计条数（排除未知、境外），由 data_processing/08_source_province.py 生成\n")
    f.write("var sourceProvince = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")

print("评价总数:", total)
print("未知 IP 属地:", unknown_count, f"({unknown_count/total*100:.1f}%)")
print("境外:", overseas_count)
print("本省（湖南）占比（在有效省份数据里）:", hunan_share, "%")
print("前10省份:")
for row in top10:
    print(" -", row["name"], row["count"])
print("已保存:", OUT)
