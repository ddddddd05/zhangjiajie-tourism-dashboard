# 中间"景区分布与口碑"地图要用的数据：5 个景点的坐标 + 口碑指标
#   口碑用两个指标：
#   ① 全站好评率（主要指标，画地图点的颜色用它）：来自携程页面上的标签总数，不受我们采样方式影响
#   ② 样本平均评分（辅助参考，鼠标提示里显示）：来自我们采集的"普通"评价（不含差评筛选那部分）
import os
import json
import re

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
REVIEW_SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
COUNT_SRC = BASE_DIR + r"\data\张家界-携程评价总数.csv"
OUT = BASE_DIR + r"\dashboard\data\spotReview.js"

# 5 个景点的坐标：2026-10-23 从 OpenStreetMap 查得（黄龙洞词条另有 Wikidata Q5925989 可交叉核对）
#   取点说明：森林公园取南门售票处、天门山取保护区中心点、玻璃桥取桥体中心、
#            黄龙洞取洞口、宝峰湖取湖区中心
SPOTS = {
    "张家界国家森林公园": {"lat": 29.3157, "lon": 110.4291, "district": "武陵源区"},
    "天门山国家森林公园": {"lat": 29.0503, "lon": 110.4786, "district": "永定区"},
    "张家界大峡谷玻璃桥": {"lat": 29.3990, "lon": 110.6980, "district": "慈利县"},
    "黄龙洞": {"lat": 29.3680, "lon": 110.6147, "district": "武陵源区"},
    "宝峰湖": {"lat": 29.3258, "lon": 110.5469, "district": "武陵源区"},
}


# ① 解析携程标签总数，算全站好评率
def parse_tags(text):
    """从"全部(39243) 好评(23985) 差评(1349)"这样的文字里，把数字抠出来"""
    nums = {}
    for name, pattern in [("全部", r"全部\((\d+)\)"), ("好评", r"好评\((\d+)\)"),
                          ("差评", r"差评\((\d+)\)"), ("消费后评价", r"消费后评价\((\d+)\)")]:
        m = re.search(pattern, text)
        nums[name] = int(m.group(1)) if m else 0
    return nums


count = pd.read_csv(COUNT_SRC)
count[["全部", "好评", "差评", "消费后评价"]] = count["携程标签"].apply(lambda t: pd.Series(parse_tags(t)))
# 去重：森林公园因为试跑多了一条记录，数字和正式那条一样，按"全部"数最大的保留一条
count = count.sort_values("全部", ascending=False).drop_duplicates("景点", keep="first")
count = count.set_index("景点")

# ② 从采集到的评价里，算每个景点"普通"样本的平均分
review = pd.read_csv(REVIEW_SRC, parse_dates=["日期"])
avg_score = review[review["采集类型"] == "普通"].groupby("景点")["评分"].mean().round(2)
date_range = review.groupby("景点")["日期"].agg(["min", "max"])

# ③ 合并成最终数据
rows = []
for name, info in SPOTS.items():
    c = count.loc[name]
    good_rate = round(c["好评"] / c["全部"] * 100, 1)
    bad_rate = round(c["差评"] / c["全部"] * 100, 1)
    verified_rate = round(c["消费后评价"] / c["全部"] * 100, 1)
    dr = date_range.loc[name]
    rows.append({
        "name": name,
        "lat": info["lat"],
        "lon": info["lon"],
        "district": info["district"],
        "total": int(c["全部"]),
        "goodRate": good_rate,
        "goodCount": int(c["好评"]),
        "badRate": bad_rate,
        "badCount": int(c["差评"]),
        "verifiedRate": verified_rate,
        "avgScore": float(avg_score.get(name, 0)),
        "dateFrom": dr["min"].strftime("%Y-%m"),
        "dateTo": dr["max"].strftime("%Y-%m"),
    })

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 5 个景点的坐标与口碑指标，由 data_processing/07_spot_review_summary.py 生成\n")
    f.write("var spotReview = " + json.dumps(rows, ensure_ascii=False, indent=2) + ";\n")

for r in rows:
    print(f"{r['name']}：全部{r['total']} 好评{r['goodCount']}条({r['goodRate']}%) 差评{r['badCount']}条({r['badRate']}%) "
          f"消费后评价占比{r['verifiedRate']}% 样本均分{r['avgScore']} 评价时间{r['dateFrom']}~{r['dateTo']}")
print("已保存:", OUT)
