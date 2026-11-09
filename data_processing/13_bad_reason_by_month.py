# 页面三"舆情河流图"要用的数据：差评原因分类（复用 09 的关键词规则），按月份（跨年汇总）统计
#   和 monthReview/monthTemp 同一种口径：12 个月把 2016-2026 所有差评按月份汇总，不分年份
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\badReasonMonth.js"

CATEGORIES = {
    "排队拥挤": ["排队", "人太多", "人多", "拥挤", "挤", "小时"],
    "服务态度": ["态度", "服务差", "讲解员", "导游", "工作人员", "应付", "素质", "骗", "谎话", "赶鸭子"],
    "票务问题": ["退票", "改签", "手续费", "客服", "门票过期", "学生票", "买票", "退款", "取不了票", "预订信息"],
    "价格性价比": ["价格", "性价比", "贵", "不值", "坑", "辣鸡"],
    "环境卫生": ["厕所", "臭", "闷热", "脏", "空气不太好", "拉尿"],
    "设施陈旧": ["设施", "陈旧", "老旧", "配套", "破败"],
    "天气能见度": ["雾", "天气不好", "看不见", "看不到", "白茫茫"],
    "强制消费": ["强制", "强行", "捆绑", "强逼", "不买就", "VIP", "另外加", "强迫"],
    "额外收费": ["另外收费", "另付费", "二次消费", "不包含", "另外加钱", "额外", "再买", "单独购买", "另收费", "不包"],
    "路线指引不清": ["路线不明", "没有指引", "路牌", "指示不明显", "标识不清", "指引", "路线规划"],
}

# 河流图只放数量靠前的几类，太碎的类别(个位数)混进去会变成贴着底部的细线，没有意义
TOP_CATS = ["排队拥挤", "价格性价比", "服务态度", "天气能见度", "票务问题", "额外收费"]


def classify(text):
    text = str(text)
    best_cat, best_hits = None, 0
    for cat, kws in CATEGORIES.items():
        hits = sum(1 for kw in kws if kw in text)
        if hits > best_hits:
            best_cat, best_hits = cat, hits
    return best_cat or "其他"


review = pd.read_csv(SRC, encoding="utf-8-sig", parse_dates=["日期"])
bad = review[review["采集类型"] == "差评"].copy()
bad["分类"] = bad["评价内容"].apply(classify)
bad["月份"] = bad["日期"].dt.month

months = [f"{m}月" for m in range(1, 13)]
table = bad[bad["分类"].isin(TOP_CATS)].groupby(["月份", "分类"]).size()

# ECharts 的 themeRiver 必须配合"连续数值轴"才能算出流动的宽度，用类目轴(1月/2月...文字)会导致河流宽度塌成 0。
# 用日期字符串配时间轴又会被 ECharts 自己"挑好看刻度"的算法弄得跟月份对不齐。
# 所以干脆用 1~12 的月份数字当数值轴，前端用 value 轴 + min/max/interval 精确锁 12 个刻度，不会再有对不齐的问题
river_data = []
for m in range(1, 13):
    for cat in TOP_CATS:
        v = int(table.get((m, cat), 0))
        river_data.append([m, v, cat])

data = {
    "months": months,
    "categories": TOP_CATS,
    "data": river_data,
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 差评原因 × 月份（跨年汇总，供舆情河流图使用），由 data_processing/13_bad_reason_by_month.py 生成\n")
    f.write("var badReasonMonth = " + json.dumps(data, ensure_ascii=False) + ";\n")

print("差评总数:", len(bad), "　河流图覆盖类别数:", len(TOP_CATS))
for cat in TOP_CATS:
    total = int(bad[bad["分类"] == cat].shape[0])
    print(f"  {cat}: {total}")
print("已保存:", OUT)
