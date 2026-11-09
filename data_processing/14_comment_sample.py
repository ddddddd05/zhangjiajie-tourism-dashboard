# 页面三"舆情弹幕墙"要用的数据：抽样一批评论原文（好评差评都要有，5 个景点都覆盖）
#   只取：景点、评分、情感、日期、内容；不采用户名（原始数据本身也没有这一列）
#   情感：差评采集类型 -> neg；普通采集类型里评分>=4 -> pos（口径与 monthReview 的 good_rate 一致）
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\commentSample.js"

GOOD_PER_SPOT = 25
BAD_PER_SPOT = 10
MAX_LEN = 46  # 弹幕一条太长会刷不完，截断加省略号

review = pd.read_csv(SRC, encoding="utf-8-sig", parse_dates=["日期"])

rows = []
for spot, g in review.groupby("景点"):
    good = g[(g["采集类型"] == "普通") & (g["评分"] >= 4)]
    bad = g[g["采集类型"] == "差评"]
    good_sample = good.sample(min(GOOD_PER_SPOT, len(good)), random_state=42)
    bad_sample = bad.sample(min(BAD_PER_SPOT, len(bad)), random_state=42)
    for _, r in pd.concat([good_sample, bad_sample]).iterrows():
        text = str(r["评价内容"]).strip().replace("\n", " ")
        if len(text) > MAX_LEN:
            text = text[:MAX_LEN] + "…"
        rows.append({
            "spot": spot,
            "score": float(r["评分"]),
            "sentiment": "neg" if r["采集类型"] == "差评" else "pos",
            "date": r["日期"].strftime("%Y-%m"),
            "text": text,
        })

data = {"n": len(rows), "comments": rows}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 舆情弹幕墙抽样评论（不含用户名），由 data_processing/14_comment_sample.py 生成\n")
    f.write("var commentSample = " + json.dumps(data, ensure_ascii=False) + ";\n")

print("抽样总数:", len(rows))
print("按情感:", pd.DataFrame(rows)["sentiment"].value_counts().to_dict())
print("已保存:", OUT)
