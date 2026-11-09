# 页面三玫瑰图旁边"关键词"模式要用的数据：差评关键词按景点拆开，看每个景点的痛点具体是什么词
#   分词规则和停用词表跟 10_wordcloud_data.py 的差评部分保持一致，这样和第一页的差评词云口径统一
import os
import json
import re
from collections import Counter

import jieba
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\badWordsBySpot.js"

STOPWORDS = set("""
的 了 是 我 我们 你 你们 他 她 它 这 那 都 很 也 就 在 和 与 及 还 又 再 but
不 没 没有 可以 可能 真的 非常 比较 一个 一下 一次 一天 有点 什么 怎么 这个 那个
有 去 来 到 从 把 被 让 给 对 但 但是 而且 因为 所以 如果 虽然 不过
张家界 景区 景点 这里 那里 地方 游客 地方 的话 一种 一样 之后 之前 以后 以前
感觉 觉得 就是 真是 还是 不是 不会 不要 建议 可是 只是 其实 已经 一直 一定 非常
""".split())

PUNCT = re.compile(r"[，。！？、,.!?~…～、\s\d—\-()（）\"'\u200b]+")


def clean_words(texts):
    counter = Counter()
    for t in texts:
        t = PUNCT.sub(" ", str(t))
        for w in jieba.cut(t):
            w = w.strip()
            if len(w) < 2 or w in STOPWORDS:
                continue
            counter[w] += 1
    return counter


review = pd.read_csv(SRC, encoding="utf-8-sig")
bad = review[review["采集类型"] == "差评"]

result = {}
for spot, g in bad.groupby("景点"):
    counter = clean_words(g["评价内容"])
    result[spot] = [{"name": w, "value": c} for w, c in counter.most_common(18)]

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 差评关键词按景点拆开（jieba分词，口径同 wordCloud.js 的差评部分），由 data_processing/15_bad_words_by_spot.py 生成\n")
    f.write("var badWordsBySpot = " + json.dumps(result, ensure_ascii=False) + ";\n")

for spot, words in result.items():
    print(spot, "TOP8:", words[:8])
print("已保存:", OUT)
