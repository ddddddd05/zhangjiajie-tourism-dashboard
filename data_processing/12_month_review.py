# 页面二中间图"淡旺季落差"的数据：按评价日期统计 2019–2025 年各月的携程评价条数
#   只用"普通"评价：采集类型为"差评"的是专门多爬的差评，混进来会让评分和月份分布失真
#   评价日期不是游玩日期，评价量只当作客流热度的代理指标
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\monthReview.js"
Y0, Y1 = 2019, 2025  # 2019 年前几乎没有评价；2026 年只到 10 月，会少算 11、12 月

# 1. 读入评价，保留"普通"评价和完整年份
df = pd.read_csv(SRC, encoding="utf-8-sig", parse_dates=["日期"])
df = df[(df["采集类型"] == "普通") & df["日期"].dt.year.between(Y0, Y1)]
# 2. 各月评价条数和占比
count = df.groupby(df["日期"].dt.month).size().reindex(range(1, 13), fill_value=0)
data = {
    "range": f"{Y0}–{Y1}",
    "n": int(len(df)),
    "month": [f"{m}月" for m in range(1, 13)],
    "count": count.tolist(),
    "share": (count / count.sum() * 100).round(1).tolist(),
    "peak_ratio": round(count.max() / count.min(), 1),            # 最旺月 ÷ 最淡月
    "top3_share": round(count.nlargest(3).sum() / count.sum() * 100, 1),  # 最旺 3 个月占全年
    "good_rate": round((df["评分"] >= 4).mean() * 100, 1),          # 4 分及以上占比
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 张家界各月携程评价量（客流热度代理指标），由 data_processing/12_month_review.py 生成\n")
    f.write("var monthReview = " + json.dumps(data, ensure_ascii=False) + ";\n")

print(data)
print("已保存:", OUT)
