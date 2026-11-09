# 用 Selenium 打开 Chrome，像人一样翻页，采集携程上张家界 5 个景点的评价
#   普通评价：全部 + "推荐"排序，在所有页里均匀跳着取 60 页（约 600 条），让日期分散到各个季节
#   差评：差评 + "推荐"排序，均匀取 15 页（约 150 条），不足 15 页就全部采完
#   好评率不用样本算，直接记录携程标签上的总数：全部(N)、好评(N)、差评(N)
# 规矩：每页随机停 3~8 秒；不登录、不破解验证码、不用代理；页面异常（验证码/拦截）就存盘并停止
# 用法：  python 02_crawl_ctrip_reviews.py          正式采集（可以中途停，下次运行会跳过已采的页）
#         python 02_crawl_ctrip_reviews.py --test   试跑：只采第一个景点，普通和差评各 2 页
import csv
import os
import random
import re
import sys
import time
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
REVIEW_OUT = BASE_DIR + r"\data\张家界-携程评价.csv"
COUNT_OUT = BASE_DIR + r"\data\张家界-携程评价总数.csv"
LOG_OUT = BASE_DIR + r"\data_processing\crawl_log.txt"

SPOTS = {
    "张家界国家森林公园": "https://you.ctrip.com/sight/zhangjiajie23/56867.html",
    "天门山国家森林公园": "https://you.ctrip.com/sight/zhangjiajie23/8360.html",
    "张家界大峡谷玻璃桥": "https://you.ctrip.com/sight/cili2816/107396.html",
    "黄龙洞": "https://you.ctrip.com/sight/zhangjiajie23/2439.html",
    "宝峰湖": "https://you.ctrip.com/sight/zhangjiajie23/2440.html",
}
# 采集类型 -> (页面上的标签名, 要采的页数)，一页 10 条
TASKS = {"普通": ("全部", 60), "差评": ("差评", 15)}

TEST = "--test" in sys.argv
if TEST:
    SPOTS = dict(list(SPOTS.items())[:1])
    TASKS = {"普通": ("全部", 2), "差评": ("差评", 2)}

FIELDS = ["景点", "采集类型", "页码", "评分", "日期", "IP属地", "评价内容", "采集时间"]


class Blocked(Exception):
    """页面没有正常出现评价（可能是验证码或被拦截），停止采集"""


def log(msg):
    line = f"[{datetime.now():%H:%M:%S}] {msg}"
    print(line)
    with open(LOG_OUT, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def pause(a=3, b=8):
    time.sleep(random.uniform(a, b))


def done_pages():
    """读取已经采过的 (景点, 采集类型, 页码)，中途停了再运行时跳过它们"""
    if not os.path.exists(REVIEW_OUT):
        return set()
    with open(REVIEW_OUT, encoding="utf-8-sig") as f:
        return {(r["景点"], r["采集类型"], int(r["页码"])) for r in csv.DictReader(f)}


def append_rows(rows):
    new_file = not os.path.exists(REVIEW_OUT)
    with open(REVIEW_OUT, "a", newline="", encoding="utf-8-sig" if new_file else "utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            w.writeheader()
        w.writerows(rows)


def wait_for_comments(driver, timeout=15):
    """等评价出现；超时说明页面不正常"""
    end = time.time() + timeout
    while time.time() < end:
        if driver.find_elements(By.CSS_SELECTOR, ".commentItem"):
            return
        time.sleep(0.5)
    raise Blocked("等了 %d 秒没有出现评价，当前网址：%s" % (timeout, driver.current_url))


def click_by_text(driver, css, prefix):
    """点击文字以 prefix 开头的元素（比如标签"差评(106)"、排序"推荐"）"""
    for el in driver.find_elements(By.CSS_SELECTOR, css):
        if el.text.strip().startswith(prefix):
            driver.execute_script("arguments[0].click();", el)
            time.sleep(2.5)
            return el.text.strip()
    raise Blocked(f"找不到「{prefix}」按钮")


def active_page(driver):
    el = driver.find_elements(By.CSS_SELECTOR, ".ant-pagination-item-active")
    return int(el[0].text) if el else 1


def total_pages(driver):
    nums = [int(e.text) for e in driver.find_elements(By.CSS_SELECTOR, ".ant-pagination-item") if e.text.isdigit()]
    return max(nums) if nums else 1


def goto_page(driver, n):
    """跳到第 n 页：有"跳至"输入框就输入页码回车，没有就直接点页码"""
    if active_page(driver) == n:
        return
    box = driver.find_elements(By.CSS_SELECTOR, ".ant-pagination-options-quick-jumper input")
    if box:
        box[0].clear()
        box[0].send_keys(str(n), Keys.ENTER)
    else:
        driver.execute_script("arguments[0].click();",
                              driver.find_element(By.CSS_SELECTOR, f".ant-pagination-item-{n}"))
    for _ in range(20):
        time.sleep(0.5)
        if active_page(driver) == n:
            time.sleep(1.5)  # 等内容刷新
            wait_for_comments(driver)
            return
    raise Blocked(f"翻不到第 {n} 页")


def spread_pages(total, k):
    """在 1~total 页里均匀取 k 页；不够 k 页就全取"""
    if total <= k:
        return list(range(1, total + 1))
    return sorted({round(1 + i * (total - 1) / (k - 1)) for i in range(k)})


def parse_page(driver, spot, kind, page):
    rows = []
    now = f"{datetime.now():%Y-%m-%d %H:%M}"
    for item in driver.find_elements(By.CSS_SELECTOR, ".commentItem"):
        score = re.search(r"(\d)\s*分", item.find_element(By.CSS_SELECTOR, ".averageScore").text)
        footer = item.find_element(By.CSS_SELECTOR, ".commentTime").text
        date = re.search(r"\d{4}-\d{2}-\d{2}", footer)
        ip = re.search(r"IP属地：\s*(\S+)", footer)
        rows.append({
            "景点": spot, "采集类型": kind, "页码": page,
            "评分": score.group(1) if score else "",
            "日期": date.group(0) if date else "",
            "IP属地": ip.group(1) if ip else "",
            "评价内容": item.find_element(By.CSS_SELECTOR, ".commentDetail").text.strip(),
            "采集时间": now,
        })  # 不保存用户名、头像
    return rows


def crawl_spot(driver, spot, url, finished):
    log(f"打开 {spot}")
    driver.get(url)
    wait_for_comments(driver)
    pause()

    # 记录携程标签上的总数，好评率用它算
    tags = [e.text.strip() for e in driver.find_elements(By.CSS_SELECTOR, ".hotTag")]
    new_file = not os.path.exists(COUNT_OUT)
    with open(COUNT_OUT, "a", newline="", encoding="utf-8-sig" if new_file else "utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["景点", "携程标签", "记录时间"])
        w.writerow([spot, " ".join(tags), f"{datetime.now():%Y-%m-%d %H:%M}"])
    log(f"  标签：{tags}")

    for kind, (tag, k) in TASKS.items():
        click_by_text(driver, ".hotTag", tag)
        click_by_text(driver, ".sortTag", "推荐")
        wait_for_comments(driver)
        pages = spread_pages(total_pages(driver), k)
        log(f"  {kind}：共 {total_pages(driver)} 页，计划采 {len(pages)} 页")
        for p in pages:
            if (spot, kind, p) in finished:
                continue
            goto_page(driver, p)
            rows = parse_page(driver, spot, kind, p)
            append_rows(rows)
            log(f"  {kind} 第 {p} 页：{len(rows)} 条")
            pause()


def main():
    finished = done_pages()
    log(f"===== 开始{'（试跑）' if TEST else ''}，已采过 {len(finished)} 页 =====")
    # 直接用本机已下载好的 155 版驱动（和 Chrome 155 匹配），不让 Selenium 联网下载
    driver_path = os.path.expanduser(r"~\.cache\selenium\chromedriver\win64\155.0.8059.84\chromedriver.exe")
    options = webdriver.ChromeOptions()
    # 指明 Chrome 的位置：不指明时驱动会去用户文件夹下找，用户名是中文时会找错路径、启动失败
    options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    driver = webdriver.Chrome(service=Service(driver_path), options=options)  # 打开一个新的 Chrome 窗口，不用你的登录信息
    try:
        for spot, url in SPOTS.items():
            crawl_spot(driver, spot, url, finished)
            pause(10, 20)  # 换景点前多歇一会儿
        log("===== 全部完成 =====")
    except Blocked as e:
        log(f"!!!!! 停止：{e}。已采的数据都已保存，处理完后重新运行会从断点继续")
    except Exception as e:
        log(f"!!!!! 出错停止：{type(e).__name__}: {e}。已采的数据都已保存")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
