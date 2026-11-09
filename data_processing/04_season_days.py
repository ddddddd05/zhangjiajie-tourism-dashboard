# 左中图表"近十年四季天数"的数据：按气温给 2014–2023 年的每一天划分季节，再数每年各季有多少天
#   划分方法（参照气象行业标准 QX/T 152《气候季节划分》的思路，简化版）：
#   滑动 5 日平均气温 ≥22℃ 为夏，<10℃ 为冬，其余上半年为春、下半年为秋
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-气温历史数据-2014_2023.csv"
OUT = BASE_DIR + r"\dashboard\data\seasonDays.js"
# 1. 读入张家界日气温，按日期排好序（滑动平均要求前后相邻的天是连续的）
temp = pd.read_csv(SRC, parse_dates=["日期"]).sort_values("日期")
# 2. 滑动 5 日平均：这一天和前后各 2 天，共 5 天的平均气温，消除单独一两天的冷热波动
#    center=True 表示以这一天为中心；min_periods=1 让首尾几天也能算（只用能取到的天）
temp["滑动5日均温"] = temp["当天平均气温"].rolling(5, center=True, min_periods=1).mean()
# 3. 按规则给每一天贴上季节
def season(row):
    if row["滑动5日均温"] >= 22:
        return "夏"
    if row["滑动5日均温"] < 10:
        return "冬"
    return "春" if row["日期"].month <= 6 else "秋"

temp["季节"] = temp.apply(season, axis=1)
# 4. 交叉统计：行是年份，列是季节，格子里是天数
temp["年份"] = temp["日期"].dt.year
days = pd.crosstab(temp["年份"], temp["季节"])[["春", "夏", "秋", "冬"]]
# 5. 整理成图表要用的数组，写成 js
data = {
    "year": [str(y) for y in days.index],
    "spring": days["春"].tolist(),
    "summer": days["夏"].tolist(),
    "autumn": days["秋"].tolist(),
    "winter": days["冬"].tolist(),
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 张家界 2014–2023 年每年四季天数，由 data_processing/04_season_days.py 生成\n")
    f.write("var seasonDays = " + json.dumps(data, ensure_ascii=False) + ";\n")

print(days.assign(合计=days.sum(axis=1)).to_string())
print("10 年平均:", days.mean().round(1).to_dict())
print("已保存:", OUT)
