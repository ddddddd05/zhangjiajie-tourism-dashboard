# 左上图表"月均气温"的数据：把 2014–2023 年每天的气温，按月份算 10 年平均
#   输出成 js 文件，大屏用 <script> 直接引入（双击打开 html 时，浏览器不允许网页读取本地 csv）
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-气温历史数据-2014_2023.csv"
OUT = BASE_DIR + r"\dashboard\data\monthTemp.js"

# 1. 读入 01 脚本提取出的张家界日气温（3652 天）
temp = pd.read_csv(SRC, parse_dates=["日期"])

# 2. 取出月份（1~12），按月份分组求平均：10 年里所有 1 月的天放在一起平均，以此类推
temp["月份"] = temp["日期"].dt.month
month = temp.groupby("月份")[["当天平均气温", "当天最高气温", "当天最低气温"]].mean().round(1)
# 3. 整理成图表要用的 4 个数组
data = {
    "month": [f"{m}月" for m in month.index],
    "avg": month["当天平均气温"].tolist(),   # 月平均气温 → 折线
    "max": month["当天最高气温"].tolist(),   # 月平均最高气温 → 带子上沿
    "min": month["当天最低气温"].tolist(),   # 月平均最低气温 → 带子下沿
}
# 4. 写成 js：var monthTemp = {...};
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 张家界 2014–2023 年月均气温（℃），由 data_processing/03_month_temp.py 生成\n")
    f.write("var monthTemp = " + json.dumps(data, ensure_ascii=False) + ";\n")

print("参与计算的天数:", len(temp))
print(month.T.to_string())
print("已保存:", OUT)
