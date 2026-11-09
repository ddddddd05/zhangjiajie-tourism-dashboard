# 从两份全国大表中只取出张家界（zjj = ZhangJiaJie）2014–2023 年的数据，各存成一个小文件
#   一、气温：460 万行的 csv，Excel 打不全
#   二、空气：xlsx 分成两张工作表（第一张已经满到 Excel 行数上限），两张都要读
import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
OUT_DIR = BASE_DIR + r"\data"  # 提取出的数据统一放在 data 文件夹

# 分析时间段：两份数据完整重叠的 10 年
START = "2014-01-01"
END = "2023-12-31"

# ==================== 一、气温 temperature ====================
TEMP_SRC = BASE_DIR + r"\中国城市每日气温历史数据(1980.1-2023.12).csv"
TEMP_OUT = OUT_DIR + r"\张家界-气温历史数据-2014_2023.csv"

# 1. 读入全国数据（文件末尾多一个逗号，会多出一列空列，用 usecols 只取需要的 7 列；
#    行政区划代码当文字读，否则表里的 2 个空行会让整列变成小数，430800 变成 430800.0）
temp_all = pd.read_csv(TEMP_SRC, usecols=range(7), dtype={"行政区划代码": str, "日期": str})

# 2. 筛选：只留下城市名称是"张家界市"的行（气温表的城市名带"市"）
temp = temp_all[temp_all["城市名称"] == "张家界市"].copy()

# 3. 把 20230101 这种文本日期转成真正的日期，按时间排序
temp["日期"] = pd.to_datetime(temp["日期"], format="%Y%m%d")
temp = temp.sort_values("日期")

# 4. 只保留 2014–2023 这 10 年
temp = temp[(temp["日期"] >= START) & (temp["日期"] <= END)]

# 5. 保存（utf-8-sig 编码让 Excel 打开中文不乱码）
temp.to_csv(TEMP_OUT, index=False, encoding="utf-8-sig")

print("【气温】全国总行数:", len(temp_all))
print("【气温】张家界行数:", len(temp))
print("【气温】日期范围:", temp["日期"].min().date(), "~", temp["日期"].max().date())

# ==================== 二、空气质量 air quality ====================
AIR_SRC = BASE_DIR + r"\地级市-空气质量指数（2013-2024年）.xlsx"
AIR_OUT = OUT_DIR + r"\张家界-空气质量-2014_2023.csv"

# 1. 两张工作表都读进来（sheet_name=None 表示读全部工作表）。
#    第 A 列是序号、L 列之后是空列，所以只取 B~L 列。文件很大，这一步要等几分钟
sheets = pd.read_excel(AIR_SRC, sheet_name=None, usecols="B:L")
print("【空气】工作表:", {name: len(df) for name, df in sheets.items()})

# 2. 把两张表上下拼接成一张
air_all = pd.concat(sheets.values(), ignore_index=True)

# 3. 筛选：空气表的城市名不带"市"，所以这里写"张家界"
air = air_all[air_all["城市"] == "张家界"].copy()

# 4. 按日期排序；如果两张表交界处有重复的日期，只保留一条
air["日期"] = pd.to_datetime(air["日期"])
dup_count = air.duplicated(subset="日期").sum()
air = air.drop_duplicates(subset="日期").sort_values("日期")

# 5. 只保留 2014–2023 这 10 年（去掉 2013 年最后一天和 2024 年的部分）
air = air[(air["日期"] >= START) & (air["日期"] <= END)]

# 6. 保存
air.to_csv(AIR_OUT, index=False, encoding="utf-8-sig")

print("【空气】全国总行数:", len(air_all))
print("【空气】张家界行数:", len(air), "（去掉重复日期", dup_count, "条）")
print("【空气】日期范围:", air["日期"].min().date(), "~", air["日期"].max().date())
print("【空气】10年应有天数:", len(pd.date_range(START, END)), " 缺少:", len(pd.date_range(START, END)) - len(air), "天")
print("【空气】各列空值个数:", air.isna().sum().to_dict())
