# 左下图表"空气优良率（月）"的数据：2014–2023 年每个月有百分之多少的天数空气优良
#   优良 = AQI ≤ 100（国家标准 HJ 633-2012 中的"优"和"良"两级）
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-空气质量-2014_2023.csv"
OUT = BASE_DIR + r"\dashboard\data\airMonth.js"

# 1. 读入 01 脚本提取出的张家界日空气质量（3652 天，AQI 没有空值）
air = pd.read_csv(SRC, parse_dates=["日期"])

# 2. 每天是否优良：是记 True，否记 False；对 True/False 求平均，就是优良天数的比例
air["优良"] = air["AQI"] <= 100
air["年份"] = air["日期"].dt.year
air["月份"] = air["日期"].dt.month

# 3. 透视表：行是年份，列是月份，格子里是这个月的优良率（%）
rate = air.pivot_table(index="年份", columns="月份", values="优良", aggfunc="mean").mul(100).round(1)

# 4. 热力图要的数据格式：每一格是 [月份序号, 年份序号, 优良率]，序号从 0 开始
#    （int、float 把 pandas 的数字转成普通 Python 数字，json 才能保存）
cells = [[int(m) - 1, i, float(rate.loc[y, m])] for i, y in enumerate(rate.index) for m in rate.columns]

# 5. 每年的优良率，用在鼠标提示里
year_rate = air.groupby("年份")["优良"].mean().mul(100).round(1)

# 6. 十年日均全国排名（KPI 条要用）：rank 列是当天 AQI 在全国地级市里的排名，数字越小空气越好；
#    个别几天没有排名（31 个空值），求平均时自动跳过
avg_rank = round(float(air["rank"].mean()))

# 7. 十年总体优良率（KPI 条要用）：精确算法——优良总天数 ÷ 总天数，
#    不能用"每年优良率的平均值"代替（那样是近似值：每年天数不完全一样，闰年 366 天，
#    直接对年度百分比取平均，等于把每一年的权重看成相等，会有误差；这里是日级数据，
#    按天数直接算总占比才精确）
overall_rate = round(float(air["优良"].mean()) * 100, 1)

data = {
    "year": [str(y) for y in rate.index],
    "month": [f"{m}月" for m in rate.columns],
    "cells": cells,
    "yearRate": year_rate.tolist(),
    "avgRank": avg_rank,
    "overallRate": overall_rate,
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 张家界 2014–2023 年各月空气优良率（%），由 data_processing/05_air_good_rate.py 生成\n")
    f.write("var airMonth = " + json.dumps(data, ensure_ascii=False) + ";\n")

print(rate.astype(int).to_string())
print("每年优良率:", year_rate.to_dict())
print("十年日均全国排名:", avg_rank)
print("十年总体优良率（精确值）:", overall_rate)
print("格子数:", len(cells))
print("已保存:", OUT)
