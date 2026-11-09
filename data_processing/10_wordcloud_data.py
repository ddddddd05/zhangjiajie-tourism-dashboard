# 右下"好评/差评词云"要用的数据：用 jieba 分词，分别统计好评、差评里的高频词
#   好评样本：采集类型="普通"里评分>=4 的（"普通"是按携程默认顺序采的，没按情感筛过，这里自己筛一下）
#   差评样本：采集类型="差评"的全部（这部分本来就是用携程的"差评"筛选器采的）
import os
import json
import re
from collections import Counter

import jieba
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
SRC = BASE_DIR + r"\data\张家界-携程评价.csv"
OUT = BASE_DIR + r"\dashboard\data\wordCloud.js"

# 停用词：虚词、代词、语气词，还有"张家界""景区""景点"这种到处都是、放词云里没信息量的词
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


review = pd.read_csv(SRC)
good = review[(review["采集类型"] == "普通") & (review["评分"] >= 4)]
bad = review[review["采集类型"] == "差评"]

good_counter = clean_words(good["评价内容"])
bad_counter = clean_words(bad["评价内容"])

data = {
    "goodSampleCount": int(len(good)),
    "badSampleCount": int(len(bad)),
    "good": [{"name": w, "value": c} for w, c in good_counter.most_common(60)],
    "bad": [{"name": w, "value": c} for w, c in bad_counter.most_common(60)],
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 好评/差评高频词，jieba 分词统计，由 data_processing/10_wordcloud_data.py 生成\n")
    f.write("var wordCloud = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")

print("好评样本数:", len(good))
print("差评样本数:", len(bad))
print("好评TOP15:", good_counter.most_common(15))
print("差评TOP15:", bad_counter.most_common(15))
print("已保存:", OUT)
