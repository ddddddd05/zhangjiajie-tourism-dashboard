# 右中"差评原因分类"图要用的数据：把每条差评按关键词分类，算出每类有多少条
#   分类方法：给每一类定一批关键词，一条差评命中哪类关键词最多就算哪类；
#   都没命中的归"其他"。关键词是看了 30 条差评抽样后手动定的（见对话记录），不是算法自动聚类
import os
import json

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\badReasonCount.js"

CATEGORIES = {
    "排队拥挤": ["排队", "人太多", "人多", "拥挤", "挤", "小时"],
    "服务态度": ["态度", "服务差", "讲解员", "导游", "工作人员", "应付", "素质", "骗", "谎话", "赶鸭子"],
    "票务问题": ["退票", "改签", "手续费", "客服", "门票过期", "学生票", "买票", "退款", "取不了票", "预订信息"],
    "价格性价比": ["价格", "性价比", "贵", "不值", "坑", "辣鸡"],
    "环境卫生": ["厕所", "臭", "闷热", "脏", "空气不太好", "拉尿"],
    "设施陈旧": ["设施", "陈旧", "老旧", "配套", "破败"],
    "天气能见度": ["雾", "天气不好", "看不见", "看不到", "白茫茫"],
    # 看了"其他"类的抽样后补的：好几条差评在说被强迫消费，之前的分类没覆盖到
    "强制消费": ["强制", "强行", "捆绑", "强逼", "不买就", "VIP", "另外加", "强迫"],
    # 把全部 181 条"其他"差评看完一遍后，又补的两个类别（之前只抽样看了 25 条，漏了这两个明显主题）
    "额外收费": ["另外收费", "另付费", "二次消费", "不包含", "另外加钱", "额外", "再买", "单独购买", "另收费", "不包"],
    "路线指引不清": ["路线不明", "没有指引", "路牌", "指示不明显", "标识不清", "指引", "路线规划"],
}

review = pd.read_csv(SRC)
bad = review[review["采集类型"] == "差评"].copy()


def classify(text):
    text = str(text)
    best_cat, best_hits = None, 0
    for cat, kws in CATEGORIES.items():
        hits = sum(1 for kw in kws if kw in text)
        if hits > best_hits:
            best_cat, best_hits = cat, hits
    return best_cat or "其他"


bad["分类"] = bad["评价内容"].apply(classify)
counts = bad["分类"].value_counts()

# 按景点也拆一份（D3 地图点击联动以后要用：点击某个景点，右栏只看这个景点的差评分类）
by_spot = {}
for spot, g in bad.groupby("景点"):
    by_spot[spot] = g["分类"].value_counts().to_dict()

data = {
    "total": int(len(bad)),
    "overall": [{"name": k, "value": int(v)} for k, v in counts.items()],
    "bySpot": by_spot,
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 差评原因分类：关键词匹配，由 data_processing/09_bad_review_category.py 生成\n")
    f.write("var badReasonCount = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")

print("差评总数:", len(bad))
print("分类结果:")
for k, v in counts.items():
    print(f"  {k}: {v}")
print("已保存:", OUT)
