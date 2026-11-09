// 大屏图表：每个图表写在一个立即执行函数里，变量互不干扰

// ========== 中间最上：关键指标条（KPI，不是 ECharts 图表，是普通 HTML） ==========
// 4 个数字：年均气温 / 空气优良率 / 游客好评率 / 差评占比
// （原来还有"全国空气排名"，和空气优良率信息重复，2026-10-23 去掉了；
//   05 脚本算的 avgRank 数据还留在 airMonth.js 里，以后想加回来随时能用）
(function () {
    // 年均气温：12 个月的月均温再求平均
    var avgTemp = (monthTemp.avg.reduce(function (s, v) { return s + v; }, 0) / monthTemp.avg.length).toFixed(1);

    // 空气优良率：05 脚本已经按"优良总天数÷总天数"精确算好了十年总体优良率
    // toFixed(1) 补一位小数：JSON 里的 90.0 解析成数字后末尾的 0 会丢掉，显示就成了"90"，和其他几项的小数位数不一致
    var avgAirRate = airMonth.overallRate.toFixed(1);

    // 游客好评率 / 差评占比：5 个景点按评价总数加权平均，不能直接对 5 个 goodRate 求平均
    // （不然评价少的景点和评价多的景点权重一样，不准确）
    var totalReviews = spotReview.reduce(function (s, x) { return s + x.total; }, 0);
    var totalGood = spotReview.reduce(function (s, x) { return s + x.goodCount; }, 0);
    var totalBad = spotReview.reduce(function (s, x) { return s + x.badCount; }, 0);
    var goodRate = (totalGood / totalReviews * 100).toFixed(1);
    var badRate = (totalBad / totalReviews * 100).toFixed(1);

    // tone 按数值含义配色：warm=温度这类没有好坏之分的中性值，good=越高越好，bad=越高越糟（预警色）
    // target 是动画要滚到的目标数字；decimals 是滚动过程中显示几位小数；prefix 是数字前面不参与滚动的文字
    // label 尽量短，一行放得下；详细说明放进 title，鼠标悬停才显示，不占面板空间
    var items = [
        { target: parseFloat(avgTemp), decimals: 1, prefix: "", unit: "℃", label: "年均气温", title: "2014–2023 年月均温的平均值", tone: "warm" },
        { target: parseFloat(avgAirRate), decimals: 1, prefix: "", unit: "%", label: "空气优良率", title: "2014–2023 年十年总体优良率", tone: "good" },
        { target: parseFloat(goodRate), decimals: 1, prefix: "", unit: "%", label: "游客好评率", title: "5 个景点按评价总数加权平均", tone: "good" },
        { target: parseFloat(badRate), decimals: 1, prefix: "", unit: "%", label: "差评占比", title: "5 个景点按评价总数加权平均", tone: "bad" }
    ];

    var html = items.map(function (it) {
        // num 单独包一层：动画只改这里面的数字，前缀文字、单位都不动
        return '<div class="kpi-item tone-' + it.tone + '" title="' + it.title + '"><span class="kpi-value">' + it.prefix +
            '<span class="num">0</span><span class="unit">' + it.unit + '</span></span>' +
            '<span class="kpi-label"><span class="kpi-dot"></span>' + it.label + '</span></div>';
    }).join("");

    document.querySelector(".center1 .kpi-bar").innerHTML = html;

    // 数字滚动动画：从 0 滚到目标值，ease-out（先快后慢，更像"数字稳稳落地"而不是匀速走表）
    // 5 个数字错开 120ms 依次启动，看起来是从左到右"点亮"的，而不是一起生硬地跳出来
    var nums = document.querySelectorAll(".center1 .num");
    items.forEach(function (it, i) {
        var el = nums[i];
        var duration = 1000;
        var delay = i * 120;
        var start = null;
        function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start - delay) / duration, 1);
            if (p < 0) { requestAnimationFrame(step); return; }   // 还没到这一项该开始的时间，继续等
            var eased = 1 - Math.pow(1 - p, 3);   // ease-out cubic
            el.textContent = (it.target * eased).toFixed(it.decimals);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
})();

// ========== 左上：月均气温（气温带状图） ==========
// 带子 = 每月平均最低 ~ 平均最高气温；折线 = 月平均气温；横向浅青色带 = 18~25℃ 舒适区
(function () {
    var myChart = echarts.init(document.querySelector(".left1 .chart"));

    // 带子的画法：先画一条看不见的"最低气温"线，再在它上面堆叠"最高 - 最低"的差值并填色，
    // 两条线之间被填满，就成了一条从最低到最高的带子
    var range = monthTemp.max.map(function (v, i) {
        return +(v - monthTemp.min[i]).toFixed(1);
    });

    var option = {
        color: ["#b5452f", "#c9965a"],
        // 鼠标移上去时，显示这个月的最高、平均、最低气温
        tooltip: {
            trigger: "axis",
            formatter: function (params) {
                var i = params[0].dataIndex;
                return monthTemp.month[i] +
                    "<br>平均最高：" + monthTemp.max[i] + "℃" +
                    "<br>平均气温：" + monthTemp.avg[i] + "℃" +
                    "<br>平均最低：" + monthTemp.min[i] + "℃";
            }
        },
        legend: {
            data: ["平均气温", "最低~最高"],
            right: 0,
            top: 0,
            textStyle: { color: "#2f3f3a", fontSize: 14 }
        },
        grid: {
            left: 0,
            right: 20,      // 右边多留一点，最后的"12月"不被裁掉
            top: 34,
            bottom: 0,
            containLabel: true   // 刻度文字也算在 grid 里面，不会被裁掉
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: monthTemp.month,
            axisLine: { lineStyle: { color: "#7d8a86" } },
            axisTick: { show: false },
            axisLabel: { color: "#2f3f3a", fontSize: 14, interval: 0 }   // interval: 0 让 12 个月都显示，不隔一个跳一个
        },
        yAxis: {
            type: "value",
            axisLabel: { color: "#2f3f3a", fontSize: 14, formatter: "{value}℃" },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: "rgba(47, 63, 58, .15)" } }
        },
        series: [
            {
                // 带子下沿：线和填充都不显示，只用来把带子"垫高"到最低气温
                name: "最低",
                type: "line",
                stack: "band",
                data: monthTemp.min,
                symbol: "none",
                smooth: true,        // 和带子本体一样平滑，上下沿才对得齐
                lineStyle: { opacity: 0 }
            },
            {
                // 带子本体：在最低气温上面再堆"最高 - 最低"，用砂岩暖色半透明填满
                name: "最低~最高",
                type: "line",
                stack: "band",
                data: range,
                symbol: "none",
                smooth: true,
                lineStyle: { opacity: 0 },
                areaStyle: { color: "rgba(201, 150, 90, .4)" }   // 砂岩暖色，比金色在浅底上更显眼
            },
            {
                name: "平均气温",
                type: "line",
                data: monthTemp.avg,
                smooth: true,
                symbol: "circle",
                symbolSize: 6,
                lineStyle: { width: 3 },
                // 舒适区：18~25℃ 画一条横向浅青色带，平均线落在里面的月份最适合出游
                markArea: {
                    silent: true,
                    itemStyle: { color: "rgba(79, 160, 140, .18)" },
                    label: { color: "#2f6b5c", fontSize: 13, position: "insideTopLeft" },
                    data: [[{ yAxis: 18, name: "舒适区 18~25℃" }, { yAxis: 25 }]]
                }
            }
        ]
    };

    myChart.setOption(option);
    // 浏览器窗口大小变化时，图表跟着重新计算大小
    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== 左中：近十年四季天数（横向堆叠条形图） ==========
// 每一年一根横条，从左到右依次是春、夏、秋、冬，每段长度 = 这一季的天数
(function () {
    var myChart = echarts.init(document.querySelector(".left2 .chart"));

    // 四个季节共用的设置：都堆叠在同一根横条上，段内显示天数
    function seasonSeries(name, data) {
        return {
            name: name,
            type: "bar",
            stack: "year",        // stack 相同的系列首尾相接，拼成一根横条
            barWidth: "62%",
            data: data,
            label: {
                show: true,
                color: "#fff",
                fontSize: 12
            }
        };
    }

    var option = {
        // 春嫩绿、夏朱红、秋金黄、冬灰蓝
        color: ["#7fae6a", "#c0583f", "#d6a64a", "#7f97a8"],
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" }   // 鼠标移上去时，整根横条后面出现阴影
        },
        legend: {
            right: 0,
            top: 0,
            itemWidth: 14,
            itemHeight: 10,
            textStyle: { color: "#2f3f3a", fontSize: 14 }
        },
        grid: {
            left: 0,
            right: 10,
            top: 30,
            bottom: 0,
            containLabel: true
        },
        xAxis: {
            type: "value",
            max: 366,             // 横条总长就是一年的天数
            axisLabel: { color: "#2f3f3a", fontSize: 13 },
            splitLine: { lineStyle: { color: "rgba(47, 63, 58, .15)" } }
        },
        yAxis: {
            type: "category",
            data: seasonDays.year,
            inverse: true,        // 反过来排：2014 在最上面，2023 在最下面
            axisLine: { lineStyle: { color: "#7d8a86" } },
            axisTick: { show: false },
            axisLabel: { color: "#2f3f3a", fontSize: 13, interval: 0 }   // 10 个年份都显示
        },
        series: [
            seasonSeries("春", seasonDays.spring),
            seasonSeries("夏", seasonDays.summer),
            seasonSeries("秋", seasonDays.autumn),
            seasonSeries("冬", seasonDays.winter)
        ]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== 左下：空气优良率（年 × 月热力图） ==========
// 横向 12 个月、纵向 10 年，每格颜色 = 这个月空气优良（AQI ≤ 100）天数的比例
// 从上往下看是十年的变化，从左往右看是一年里的季节规律
(function () {
    var myChart = echarts.init(document.querySelector(".left3 .chart"));

    var option = {
        tooltip: {
            formatter: function (p) {
                var y = p.data[1];
                return airMonth.year[y] + "年" + airMonth.month[p.data[0]] +
                    "<br>优良率：" + p.data[2] + "%" +
                    "<br>全年优良率：" + airMonth.yearRate[y] + "%";
            }
        },
        grid: {
            left: 0,
            right: 10,
            top: 30,
            bottom: 0,
            containLabel: true
        },
        xAxis: {
            type: "category",
            data: airMonth.month,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: "#2f3f3a", fontSize: 13, interval: 0 }
        },
        yAxis: {
            type: "category",
            data: airMonth.year,
            inverse: true,        // 2014 在最上面
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: "#2f3f3a", fontSize: 13, interval: 0 }
        },
        // 分段颜色：优良率越高越偏青（好），越低越偏砂岩红（差）
        visualMap: {
            type: "piecewise",
            orient: "horizontal",
            right: 0,
            top: 0,
            itemWidth: 12,
            itemHeight: 10,
            itemGap: 6,
            textStyle: { color: "#2f3f3a", fontSize: 12 },
            pieces: [   // gte 是"≥"、lt 是"<"，每段都写清上下界，边界上的值不会漏掉
                { gte: 100, label: "100%", color: "#3f9e8f" },
                { gte: 90, lt: 100, label: "90+", color: "#9cc9b8" },
                { gte: 75, lt: 90, label: "75+", color: "#e3c06a" },
                { gte: 50, lt: 75, label: "50+", color: "#d98c4a" },
                { lt: 50, label: "<50", color: "#c0583f" }
            ]
        },
        series: [
            {
                type: "heatmap",
                data: airMonth.cells,
                // 格子之间留白线，一格一格分得清
                itemStyle: { borderColor: "rgba(255, 255, 255, .7)", borderWidth: 1 },
                emphasis: { itemStyle: { borderColor: "#2f3f3a", borderWidth: 1.5 } }
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== 中间：景区分布与口碑（张家界地图 + 景点气泡） ==========
// 地图 = 4 个区县轮廓（有景点的区县底色稍深）；气泡 = 5 个景点，颜色按好评率分档，大小按评价总数
(function () {
    var myChart = echarts.init(document.querySelector(".center2 .chart"));

    // 把地图数据注册给 ECharts，起名"zhangjiajie"，下面画图时就能用这个名字
    echarts.registerMap("zhangjiajie", zjjGeoJson);

    // ② 差评预警：差评率明显高于平均值（取平均的 1.2 倍）才标 ⚠，不然 5 个景点里天然就有
    // 一半左右会高于平均值，标太多就失去"预警"的意义了
    var avgBadRate = spotReview.reduce(function (sum, s) { return sum + s.badRate; }, 0) / spotReview.length;
    var warnThreshold = avgBadRate * 1.2;

    // ④ 区县底色不再按好评率染色（和气泡颜色表达的是同一件事，视觉重复、也更乱），
    // 统一用一个浅植被色打底，视觉重量留给气泡和预警标记；悬停时仍会在 tooltip 里列出该区的景点和好评率

    // 这个面板格子比较宝贵（center2 是中间栏最大的一块），用 tab 切换共用：地图 / 客源省份，
    // 不用两个面板分别装（客源省份的 10 个省份条形图放进旁边 3.81rem 的小格子会很挤）
    var mapOption = {
        tooltip: {
            // trigger 不设成 item，自己根据 componentType 判断是地图区域还是景点气泡
            formatter: function (p) {
                if (p.data && p.data.isDistrict) {   // 区名标记点：显示区名 + 区内景点好评率
                    var spots = spotReview.filter(function (s) { return s.district === p.name; });
                    if (!spots.length) return "<b>" + p.name + "</b><br>暂未纳入统计的景点";
                    var lines = spots.map(function (s) { return s.name + "：好评率 " + s.goodRate + "%"; });
                    return "<b>" + p.name + "</b><br>" + lines.join("<br>");
                }
                if (p.seriesType === "effectScatter") {   // 气泡类型已经改成 effectScatter，这里要跟着改
                    var d = p.data;
                    return "<b>" + d.name + "</b>（" + d.district + "）" +
                        "<br>好评率：" + d.goodRate + "%　差评率：" + d.badRate + "%" +
                        "<br>评价总数：" + d.total.toLocaleString() +
                        "<br>样本均分：" + d.avgScore + "（推荐排序样本，偏高，仅供参考）";
                }
                if (p.componentType === "geo") {   // 鼠标移到区域底色上：列出这个区的景点和整体好评率
                    var spots = spotReview.filter(function (s) { return s.district === p.name; });
                    if (!spots.length) return "<b>" + p.name + "</b><br>暂未纳入统计的景点";
                    var lines = spots.map(function (s) { return s.name + "：好评率 " + s.goodRate + "%"; });
                    return "<b>" + p.name + "</b><br>" + lines.join("<br>");
                }
                return p.name;
            }
        },
        geo: {
            map: "zhangjiajie",
            roam: true,            // 允许鼠标滚轮缩放、拖动平移，景点挨得近时滚轮放大能看清
            zoom: 1.1,             // 默认稍微放大一点，开场就比纯轮廓饱满
            scaleLimit: { min: 1, max: 6 },   // 缩小不能小于初始大小，放大最多到 6 倍
            label: { show: false },   // 区名不常驻显示，鼠标移上去用提示框弹出来
            itemStyle: {
                // 原来 .22 太淡、和身后的山水背景糊在一起，加深加一点阴影，轮廓才立得起来
                areaColor: "rgba(111, 140, 128, .55)",
                borderColor: "#2f3f3a",
                borderWidth: 1.6,
                shadowBlur: 10,
                shadowColor: "rgba(47, 63, 58, .35)"
            },
            emphasis: {
                itemStyle: { areaColor: "rgba(111, 140, 128, .68)", borderColor: "#2f3f3a", borderWidth: 2.5 },
                label: { show: false }   // 兜底：防止 echarts 默认把名字印在色块上
            }
        },
        visualMap: {
            type: "piecewise",
            dimension: 2,       // 用 value 里的第 3 个数（好评率）决定颜色
            seriesIndex: 0,
            orient: "horizontal",
            right: 10,
            top: 0,
            itemWidth: 12,
            itemHeight: 10,
            itemGap: 6,
            textStyle: { color: "#2f3f3a", fontSize: 12 },
            pieces: [
                { min: 65, label: "好评≥65%", color: "#3f9e8f" },
                { min: 50, max: 64.9, label: "50~65%", color: "#d6a64a" },
                { max: 49.9, label: "<50%", color: "#c0583f" }
            ]
        },
        series: [
            {
                name: "景点",
                type: "effectScatter",      // 比普通散点多一圈向外扩散的涟漪动画
                showEffectOn: "render",
                rippleEffect: { scale: 2.8, brushType: "stroke" },
                coordinateSystem: "geo",
                data: spotReview.map(function (s) {
                    // 全名太长、挨得近的几个景点会叠在一起，标签用短名，位置也各自错开
                    var short = { "张家界国家森林公园": "森林公园", "天门山国家森林公园": "天门山",
                                  "张家界大峡谷玻璃桥": "玻璃桥", "黄龙洞": "黄龙洞", "宝峰湖": "宝峰湖" };
                    var pos = { "张家界国家森林公园": "left", "天门山国家森林公园": "bottom",
                                "张家界大峡谷玻璃桥": "top", "黄龙洞": "right", "宝峰湖": "bottom" };
                    var isWarn = s.badRate > warnThreshold;   // ② 这个景点差评率明显偏高
                    return {
                        name: s.name,
                        value: [s.lon, s.lat, s.goodRate],   // 第 3 个数交给 visualMap 用来染色
                        district: s.district,
                        goodRate: s.goodRate,
                        badRate: s.badRate,
                        total: s.total,
                        avgScore: s.avgScore,
                        // ① 标签直接带好评率，不用悬停也能读出信息；差评率偏高的加 ⚠
                        label: {
                            position: pos[s.name],
                            formatter: short[s.name] + "\n" + s.goodRate + "%" + (isWarn ? " ⚠" : "")
                        },
                        // 差评率偏高的气泡单独换成警示色描边，正常的保持原样
                        itemStyle: isWarn
                            ? { shadowBlur: 8, shadowColor: "rgba(192, 88, 63, .55)", borderColor: "#c0583f", borderWidth: 1.5 }
                            : { shadowBlur: 6, shadowColor: "rgba(0, 0, 0, .3)" }
                    };
                }),
                // 气泡大小按评价总数开平方后再换算，总数差几十倍，大小差不会太悬殊
                symbolSize: function (val, p) {
                    return 10 + Math.sqrt(p.data.total) / 10;
                },
                label: {
                    show: true,
                    color: "#2f3f3a",
                    fontSize: 11,
                    fontWeight: 500,
                    lineHeight: 14,   // 两行标签（名字+好评率）之间的行距
                    textBorderColor: "rgba(255,255,255,.85)",   // 白色描边，叠在地图上也看得清
                    textBorderWidth: 3
                }
            },
            {
                // 区名标记点：这版 echarts（4.6.0）的 geo 组件悬停不会弹出提示框，用这种气泡的
                // 方式代替——坐标是逐个验证过、确实落在对应区域里的空白处
                name: "区名",
                type: "scatter",
                coordinateSystem: "geo",
                symbol: "diamond",
                symbolSize: 10,
                itemStyle: { color: "rgba(47, 63, 58, .55)", borderColor: "#fff", borderWidth: 1 },
                data: [
                    { name: "武陵源区", value: [110.46, 29.41], isDistrict: true },
                    { name: "永定区", value: [110.56, 29.10], isDistrict: true },
                    { name: "慈利县", value: [110.85, 29.33], isDistrict: true },
                    { name: "桑植县", value: [110.15, 29.55], isDistrict: true }
                ]
            }
        ]
    };

    // ========== 客源省份中国地图：飞线图（各省份 → 张家界），评价越多线越粗越亮 ==========
    // 原来这里还塞了一个柱状图，柱状图挪到 center3 独占一个大格子了，这块腾出来的空间全部留给地图
    // 配色不用教程那套深蓝夜空+荧光青（老师不让跟教程一样），换成咱们自己这套：墨绿底、金色飞线、
    // 张家界落点用砂岩红（和⚠预警色是同一个，表示"这是核心点"）
    // 省份坐标：取各省省会经纬度（画飞线起点用，不要求精确到市中心）
    var provinceCapital = {
        "广东": [113.26, 23.13], "上海": [121.47, 31.23], "江苏": [118.78, 32.04], "湖北": [114.31, 30.52],
        "北京": [116.46, 39.92], "四川": [104.06, 30.67], "重庆": [106.55, 29.56], "山东": [117.00, 36.65],
        "浙江": [120.19, 30.26], "河南": [113.65, 34.76], "江西": [115.89, 28.68], "辽宁": [123.38, 41.80],
        "贵州": [106.71, 26.57], "陕西": [108.95, 34.27], "河北": [114.48, 38.03], "福建": [119.30, 26.08],
        "安徽": [117.27, 31.86], "云南": [102.73, 25.04], "广西": [108.33, 22.84], "山西": [112.55, 37.87],
        "黑龙江": [126.53, 45.80], "天津": [117.20, 39.13], "内蒙古": [111.65, 40.82], "甘肃": [103.73, 36.03],
        "吉林": [125.35, 43.88], "新疆": [87.68, 43.77], "海南": [110.35, 20.02], "宁夏": [106.27, 38.47],
        "青海": [101.78, 36.62], "西藏": [91.11, 29.97]
    };
    var zjjCoord = [110.48, 29.12];   // 张家界，飞线的落点

    var provinceOption = {
        tooltip: {
            trigger: "item",
            formatter: function (p) {
                if (p.seriesType === "lines") {
                    return p.data.fromName + " → 张家界：" + p.data.value + " 条评价";
                }
                return p.name + "：" + (p.value || 0) + " 条评价";
            }
        },
        geo: {
            map: "china",
            roam: true,            // 支持鼠标滚轮缩放、拖动平移
            scaleLimit: { min: 1, max: 6 },
            zoom: 1.3,             // 中国地图默认按长宽比居中会留大片空白，放大撑满格子
            layoutCenter: ["50%", "52%"],
            layoutSize: "108%",
            label: { show: false },
            itemStyle: {
                areaColor: "#1d2e28",            // 兜底色（没有数据的省份，比如台湾），墨绿底不用教程的深蓝夜空
                borderColor: "rgba(214, 190, 140, .35)"   // 金色细边
            },
            emphasis: {
                label: { show: true, color: "#f6f3ea", fontSize: 11 },
                itemStyle: { areaColor: "#2f6b5c" }
            }
        },
        visualMap: {
            type: "continuous",
            min: 0,
            // 上限不用湖南的 956（第二名广东才 149），湖南一家独大会把色阶拉满，其他省份全挤在"浅"那一端
            // 看不出深浅差异；按第二名封顶，湖南直接顶格显示最亮色，其他省份才能展开层次
            max: sourceProvince.top10[1].count,
            seriesIndex: 0,
            right: 10,
            top: 6,
            itemWidth: 10,
            itemHeight: 110,
            text: ["多", "少"],
            textStyle: { color: "#f6f3ea", fontSize: 12 },
            // 墨绿 → 金色，31 个省份全部按评价条数深浅上色，不止前10名飞线那几个
            inRange: { color: ["#1d2e28", "#5c7a6c", "#d6be8c"] }
        },
        series: [
            {
                // 全部省份按评价条数深浅染色（见上面 visualMap），不只前10名飞线那几个省份
                name: "客源分布",
                type: "map",
                map: "china",
                geoIndex: 0,
                label: { show: false },
                emphasis: { label: { show: true, color: "#f6f3ea", fontSize: 11 } },
                data: sourceProvince.allProvinces
            },
            {
                // 飞线：从各省份省会飞向张家界，线越粗越亮代表评价量越多
                name: "客源飞线",
                type: "lines",
                coordinateSystem: "geo",
                zlevel: 2,
                effect: { show: true, period: 4, trailLength: .3, symbol: "arrow", symbolSize: 5, color: "#d6be8c" },
                lineStyle: { color: "#d6be8c", curveness: .25, opacity: .55 },
                data: sourceProvince.top10
                    .filter(function (p) { return provinceCapital[p.name]; })
                    .map(function (p) {
                        return {
                            coords: [provinceCapital[p.name], zjjCoord],
                            fromName: p.name,
                            value: p.count,
                            // 线宽按评价量换算，评价最多的广东线最粗，最少的浙江线最细
                            lineStyle: { width: 1 + (p.count / sourceProvince.top10[0].count) * 4 }
                        };
                    })
            },
            {
                // 省会上的小圆点：飞线的起点标记
                name: "客源城市",
                type: "scatter",
                coordinateSystem: "geo",
                zlevel: 2,
                symbolSize: 6,
                itemStyle: { color: "#d6be8c" },
                label: { show: true, position: "top", color: "#f6f3ea", fontSize: 11, formatter: "{b}" },
                data: sourceProvince.top10
                    .filter(function (p) { return provinceCapital[p.name]; })
                    .map(function (p) { return { name: p.name, value: provinceCapital[p.name] }; })
            },
            {
                // 张家界落点：砂岩红，比省会点更大更显眼，是所有飞线的汇聚点
                name: "张家界",
                type: "effectScatter",
                coordinateSystem: "geo",
                zlevel: 3,
                rippleEffect: { scale: 3, brushType: "stroke" },
                symbolSize: 12,
                itemStyle: { color: "#c0583f" },
                label: { show: true, position: "bottom", color: "#f6f3ea", fontSize: 12, fontWeight: 600, formatter: "{b}" },
                data: [{ name: "张家界", value: zjjCoord }]
            }
        ]
    };

    myChart.setOption(mapOption);

    // tab 切换：点按钮换标题、换图例说明文字、给 echarts 换一套 option
    // setOption 第二个参数传 true（notMerge）：地图用的 geo/visualMap 配置和柱状图用的 xAxis/yAxis
    // 配置完全不是一回事，不彻底清空的话，切换几次后新旧配置会叠在一起，图会乱
    var tabTitles = { map: "景区分布与口碑", province: "客源省份分布" };
    var tabLegends = {
        map: "气泡大小 = 评价量　颜色 = 好评率　⚠ = 差评率偏高",
        province: "湖南本省占比 " + sourceProvince.hunanShare + "%（已排除未知 IP " + sourceProvince.unknownCount + " 条、境外 " + sourceProvince.overseasCount + " 条）"
    };
    var titleEl = document.getElementById("center2Title");
    var legendEl = document.querySelector(".center2 .map-legend");
    document.querySelectorAll(".center2 .tab-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".center2 .tab-btn").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            var tab = btn.dataset.tab;
            titleEl.textContent = tabTitles[tab];
            legendEl.textContent = tabLegends[tab];
            // 张家界地图和中国飞线图用的是完全不同的 geo，飞线图里 lines/scatter 系列还用了
            // zlevel 分层（为了叠在地图上面）。单用 clear() 清不干净这些分层画布，切换几次后
            // 旧的飞线会一直残留叠在新地图上——直接把整个图表实例销毁重建，保证每次都是全新画布
            myChart.dispose();
            myChart = echarts.init(document.querySelector(".center2 .chart"));
            myChart.setOption(tab === "map" ? mapOption : provinceOption);
        });
    });
    // 只注册一次：myChart 是外层 var，每次切换 tab 会被重新赋值成新实例，
    // 这里引用的是变量本身，resize 时永远拿到当前最新的那个，不用每次点击都重复 addEventListener

    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== center3（原 center3+center4 合并的宽格子）：外省客源 TOP9 ==========
// 湖南本省 956 条不放进来：和第二名广东 149 条比例悬殊，摆一起湖南一根独大、其余全被压成细线，
// 比例尺没有意义；湖南在上面地图 tab 里已经用深色重点标出来了，这里专门讲"外省客源"结构
(function () {
    var myChart = echarts.init(document.querySelector(".center3 .chart"));

    var otherProvinces = sourceProvince.top10.filter(function (p) { return p.name !== "湖南"; });
    var top9Desc = otherProvinces.slice().reverse();   // 反过来存，echarts 横向柱状图第一条数据画在最下面

    // 排名徽标：①②③ 用金/银/铜配色（用的是大屏里已经出现过的颜色——金=温度的琥珀金，
    // 银=地图底色那个灰绿，铜=印章的朱红——不是另起一套新颜色），其余名次用普通墨色小圆圈
    var rankMark = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
    var rankColor = { 1: "#c9965a", 2: "#8a9a94", 3: "#b5452f" };
    function barColor(rank) {
        var stops = {
            1: ["#edc98c", "#c9965a"],
            2: ["#b7c3bd", "#8a9a94"],
            3: ["#d08b6f", "#b5452f"]
        }[rank] || ["#5bb3a0", "#2f8a7a"];
        return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: stops[0] },
            { offset: 1, color: stops[1] }
        ]);
    }

    var option = {
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: function (params) {
                return params[0].name + "：" + params[0].value + " 条评价";
            }
        },
        grid: { left: 0, right: 50, top: 10, bottom: 0, containLabel: true },
        xAxis: {
            type: "value",
            name: "条",
            nameTextStyle: { color: "#5a6b64", fontSize: 11 },
            axisLabel: { color: "#2f3f3a", fontSize: 12 },
            splitLine: { lineStyle: { color: "rgba(47, 63, 58, .12)" } }
        },
        yAxis: {
            type: "category",
            data: top9Desc.map(function (p) { return p.name; }),
            axisLine: { lineStyle: { color: "#7d8a86" } },
            axisTick: { show: false },
            // 名字前面加排名徽标：① 在最上面（第 1 名），index 从 0 开始数到最下面，
            // 数据是反过来存的，所以排名 = 总数 - index
            axisLabel: {
                color: "#2f3f3a",
                fontSize: 13,
                interval: 0,
                formatter: function (value, index) {
                    var rank = top9Desc.length - index;
                    var tag = rankColor[rank] ? "r" + rank : "rn";
                    return "{" + tag + "|" + rankMark[rank - 1] + "} {name|" + value + "}";
                },
                rich: {
                    r1: { color: rankColor[1], fontWeight: 700, fontSize: 15 },
                    r2: { color: rankColor[2], fontWeight: 700, fontSize: 15 },
                    r3: { color: rankColor[3], fontWeight: 700, fontSize: 15 },
                    rn: { color: "#9aa8a2", fontSize: 13 },
                    name: { color: "#2f3f3a", fontSize: 13 }
                }
            }
        },
        series: [{
            type: "bar",
            barWidth: "55%",
            // 条尾圆角，不是生硬的直角；标签加粗，前三名的数字也跟着徽标颜色走
            label: {
                show: true,
                position: "right",
                fontSize: 12,
                fontWeight: 600,
                formatter: function (p) {
                    var rank = top9Desc.length - p.dataIndex;
                    return "{c" + (rankColor[rank] ? rank : "n") + "|" + p.value + "}";
                },
                rich: {
                    c1: { color: rankColor[1], fontWeight: 700 },
                    c2: { color: rankColor[2], fontWeight: 700 },
                    c3: { color: rankColor[3], fontWeight: 700 },
                    cn: { color: "#2f3f3a" }
                }
            },
            itemStyle: {
                borderRadius: [0, 6, 6, 0],
                shadowBlur: 5,
                shadowColor: "rgba(36, 51, 46, .18)",
                shadowOffsetX: 1
            },
            emphasis: {
                itemStyle: { shadowBlur: 12, shadowColor: "rgba(36, 51, 46, .3)" }
            },
            // 进场动画：从左往右长出来，9 根柱子错开依次出现，不是一下子全部弹出
            animationDuration: 900,
            animationEasing: "elasticOut",
            animationDelay: function (idx) { return idx * 70; },
            data: top9Desc.map(function (p, i) {
                var rank = top9Desc.length - i;
                return { value: p.count, itemStyle: { color: barColor(rank) } };
            })
        }]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== 右上：景点口碑对比（好评率 / 差评率 蝴蝶图） ==========
// 地图上已经显示过好评率了（气泡标签），这里不再重复画一遍好评率排名，改成"好评率 + 差评率"
// 对称展示——差评率这个维度地图上只有宝峰湖因为超标被标了 ⚠，其余景点的差评率要悬停才看得到，
// 这里专门把它摆出来，和地图形成"地图管空间分布、这里管两个指标对比"的分工
(function () {
    var myChart = echarts.init(document.querySelector(".right1 .chart"));

    // 左右各一个 grid：左边画差评率（横轴反过来，数值越大越往左延伸），右边画好评率（正常方向），
    // 两个 grid 中间留一条窄缝放景点名字，形成"蝴蝶图"（population pyramid 的常见做法）
    var sorted = spotReview.slice().sort(function (a, b) { return a.goodRate - b.goodRate; });   // 升序，从下到上好评率递增

    var option = {
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: function (params) {
                var d = spotReview.filter(function (s) { return s.name === params[0].name; })[0];
                return "<b>" + d.name + "</b>（" + d.district + "）" +
                    "<br>好评率：" + d.goodRate + "%　差评率：" + d.badRate + "%" +
                    "<br>评价总数：" + d.total.toLocaleString() +
                    "<br>样本均分：" + d.avgScore;
            }
        },
        legend: {
            data: ["差评率", "好评率"],
            top: 0,
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: "#2f3f3a", fontSize: 11 }
        },
        grid: [
            { left: 10, width: "36%", top: 26, bottom: 0 },
            { right: 10, width: "36%", top: 26, bottom: 0 }
        ],
        xAxis: [
            { type: "value", inverse: true, max: 10, gridIndex: 0, axisLabel: { formatter: "{value}%", color: "#2f3f3a", fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(47, 63, 58, .12)" } } },
            { type: "value", max: 80, gridIndex: 1, axisLabel: { formatter: "{value}%", color: "#2f3f3a", fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(47, 63, 58, .12)" } } }
        ],
        yAxis: [
            {
                type: "category", gridIndex: 0, data: sorted.map(function (s) { return s.name; }),
                position: "right", axisLine: { show: false }, axisTick: { show: false },
                axisLabel: { color: "#2f3f3a", fontSize: 12, interval: 0 }
            },
            {
                type: "category", gridIndex: 1, data: sorted.map(function (s) { return s.name; }),
                axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }
            }
        ],
        series: [
            {
                // 换一套新配色：酒红紫（差评）vs 琥珀金（好评），大屏里这两个颜色还没用过
                name: "差评率", type: "bar", xAxisIndex: 0, yAxisIndex: 0, barWidth: "55%",
                label: { show: true, position: "left", color: "#6b2c4a", fontSize: 11, fontWeight: 600, formatter: "{c}%" },
                itemStyle: { color: "#8a3b5c", borderRadius: [6, 0, 0, 6] },
                animationDuration: 900, animationEasing: "elasticOut", animationDelay: function (idx) { return idx * 100; },
                data: sorted.map(function (s) { return s.badRate; })
            },
            {
                name: "好评率", type: "bar", xAxisIndex: 1, yAxisIndex: 1, barWidth: "55%",
                label: { show: true, position: "right", color: "#9c6d1e", fontSize: 11, fontWeight: 600, formatter: "{c}%" },
                itemStyle: { color: "#c9962f", borderRadius: [0, 6, 6, 0] },
                animationDuration: 900, animationEasing: "elasticOut", animationDelay: function (idx) { return idx * 100; },
                data: sorted.map(function (s) { return s.goodRate; })
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== 右中：差评原因分类（旭日图） ==========
// 内圈 = 差评原因大类（09 脚本关键词分类算出来的）；外圈 = 这个原因具体是哪些景点贡献的，
// 用上了 09 脚本里顺带算好的 bySpot 数据（按景点拆分差评分类），不只是"哪类问题多"，
// 还能看出"这类问题主要出在哪个景点"，比单独一个饼图信息量更大
//
// 这个格子比较小（3.81rem），9 个类别挤在一起字会很小，所以把 option 的构建写成一个函数，
// 小图和"查看大图"弹窗共用同一份逻辑，big=true 时字号、边框都按比例放大，不用写两套代码
window.chartBuilders = window.chartBuilders || {};
function buildRight2Option(big) {
    var catColor = {
        "排队拥挤": "#c0583f",
        "价格性价比": "#c9965a",
        "服务态度": "#b5452f",
        "天气能见度": "#8a9a94",
        "票务问题": "#d6a64a",
        "环境卫生": "#6b8f7f",
        "强制消费": "#a8432e",
        "设施陈旧": "#7d8a86",
        "其他": "#9aa8a2"
    };

    // 把 bySpot（按景点分组）反过来拼成"每个大类下面有哪些景点"，当矩形树图的下钻子节点
    var treeData = badReasonCount.overall.map(function (cat) {
        var children = [];
        Object.keys(badReasonCount.bySpot).forEach(function (spot) {
            var c = badReasonCount.bySpot[spot][cat.name];
            if (c) children.push({ name: spot, value: c });
        });
        children.sort(function (a, b) { return b.value - a.value; });
        return {
            name: cat.name,
            value: cat.value,
            itemStyle: { color: catColor[cat.name] || "#9aa8a2" },
            children: children.length ? children : undefined
        };
    });

    return {
        tooltip: {
            formatter: function (p) {
                var pct = (p.value / badReasonCount.total * 100).toFixed(1);
                return p.name + "：" + p.value + " 条（占全部差评 " + pct + "%）";
            }
        },
        series: [{
            type: "treemap",
            roam: false,              // 不让拖动缩放，只保留点击下钻，操作更简单
            nodeClick: "zoomToNode",  // 点一个类别方块，放大显示这个类别下面的景点明细
            leafDepth: 1,             // 一开始只展开到第一层（9 个大类），不然所有层级会一起挤出来
            breadcrumb: {             // 下钻后顶部的"返回"面包屑
                top: 0,
                itemStyle: { color: "rgba(36, 51, 46, .5)", textStyle: { color: "#f6f3ea", fontSize: big ? 14 : 10 } }
            },
            label: {
                color: "#f6f3ea",
                fontSize: big ? 16 : 11,
                fontWeight: 600,
                formatter: "{b}"
            },
            upperLabel: { show: true, height: big ? 26 : 16, color: "#f6f3ea", fontSize: big ? 14 : 10 },
            itemStyle: { borderColor: "#f6f3ea", borderWidth: 2, gapWidth: 2 },
            levels: [
                {},
                { itemStyle: { borderColor: "#f6f3ea", borderWidth: 2, gapWidth: 2 } },   // 第一层：9 个差评大类
                { itemStyle: { borderColor: "rgba(246, 243, 234, .7)", borderWidth: 1, gapWidth: 1 } }   // 第二层：下钻后的景点明细
            ],
            data: treeData
        }]
    };
}
// 先不接按钮：完整树图信息量大，格子放不下，阶段D做交互时再找地方放（比如单独一个详情页/全屏模式）；
// 函数留着注册在 window.chartBuilders.right2，以后要用随时能接
window.chartBuilders.right2 = buildRight2Option;

// ========== 右中：差评原因 TOP5（简化版，先占位） ==========
// 完整 11 个类别 + 按景点下钻的树图太重，这个格子先放最主要的几个原因，一眼看完不用点
// 原来只取 TOP4，但 33(天气能见度) 和 29(票务问题) 差距很小，只取4个没道理，改成TOP5
(function () {
    var myChart = echarts.init(document.querySelector(".right2 .chart"));

    // 全新配色：大屏里红/金/青绿这几个色系已经用得到处都是了，这里换一套靛蓝色系，
    // 数值越大颜色越深——色深浅本身也在传递"问题严重程度"这层意思，不只是换个好看的颜色
    var catColor = {
        "排队拥挤": "#2e4a63",
        "价格性价比": "#3d6180",
        "服务态度": "#4d7699",
        "天气能见度": "#7fa0b8",
        "票务问题": "#a8c2d4"
    };
    // "其他"不是具体原因，排除掉再取前5——不然"其他"会排第一，这个排行就没意义了
    var top5 = badReasonCount.overall.filter(function (c) { return c.name !== "其他"; }).slice(0, 5);
    var top5Desc = top5.slice().reverse();

    var option = {
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: function (params) {
                var pct = (params[0].value / badReasonCount.total * 100).toFixed(1);
                return params[0].name + "：" + params[0].value + " 条（占全部差评 " + pct + "%）";
            }
        },
        grid: { left: 0, right: 40, top: 10, bottom: 0, containLabel: true },
        xAxis: { type: "value", axisLabel: { color: "#2f3f3a", fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(47, 63, 58, .12)" } } },
        yAxis: {
            type: "category",
            data: top5Desc.map(function (c) { return c.name; }),
            axisLine: { lineStyle: { color: "#7d8a86" } },
            axisTick: { show: false },
            axisLabel: { color: "#2f3f3a", fontSize: 12, interval: 0 }
        },
        series: [{
            type: "bar",
            barWidth: "55%",
            label: { show: true, position: "right", color: "#2f3f3a", fontSize: 12, fontWeight: 600 },
            itemStyle: { borderRadius: [0, 6, 6, 0] },
            animationDuration: 800, animationEasing: "elasticOut", animationDelay: function (idx) { return idx * 100; },
            data: top5Desc.map(function (c) { return { value: c.value, itemStyle: { color: catColor[c.name] || "#2f8a7a" } }; })
        }]
    };

    myChart.setOption(option);
    window.addEventListener("resize", function () {
        myChart.resize();
    });
})();

// ========== 右下：好评 / 差评词云对比（纯 HTML+CSS，不用 ECharts 词云组件） ==========
// 之前用 echarts-wordcloud 这个库，重新渲染同一个实例颜色会莫名变黑（排查了很久确认是库的
// 限制），而且 canvas 画出来的词云没法做到"每个词各自独立淡入淡出"——canvas 是一整张位图，
// 没法单独控制某一个字的透明度。换成纯 HTML：每个词是一个 <span>，自己的 CSS 动画自己控制，
// 永远不会有颜色失效的问题，也能做到真正"每个词各自不同时渐隐渐现、一直循环"
(function () {
    // 十六进制颜色插值：c1 是词频最高的颜色（深），c2 是词频最低的颜色（浅），按"排名"渐变
    function lerpColor(c1, c2, t) {
        var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
        var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
        var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
        var r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
    }
    function hexToRgba(hex, alpha) {
        var n = parseInt(hex.slice(1), 16);
        return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
    }

    var stage = document.getElementById("right3Stage");

    // 真正做碰撞检测的螺旋避让布局：从中心向外螺旋试位置，每个词的方框（按字数×字号估算出
    // 实际像素宽高）不能和已经放下的词重叠，放不下就继续往外找——不再是"网格+抖动"那种
    // 完全不管重叠的办法，词与词之间现在有实打实的间距保证
    // 黄金角螺旋布局：每个词的螺旋起始角度 = 它的排列序号 × 黄金角（≈2.4 弧度），不再用
    // Math.random()——这是确定性算法，同一份词表、同样的大小，不管刷新多少次结果都完全一样，
    // 不是"运气好不好"的问题。搜索范围也放大了很多（2000 次、半径步进更细），确保真的能找到
    // 完全不重叠的位置，不再有"实在找不到就将就"的退让
    var GOLDEN_ANGLE = 2.399963;

    // 排布算法：大词先占中心，沿黄金角螺旋一圈圈往外找不重叠的空位——半径完全由"要绕开已经
    // 放下的词"这个真实约束决定，不是预先划好格子硬分配。字号越大，自然被挤得越靠外，不会出现
    // "格子分配到中心附近、结果和旁边的大字贴在一起"的问题。找不到就退一步扫全图挑最近的空位兜底。
    function placeWords(boxes) {
        var pad = 2.2;
        var order = boxes.map(function (_, i) { return i; })
            .sort(function (a, b) { return boxes[b].h - boxes[a].h; });

        var placed = [];
        var positions = new Array(boxes.length);
        window.__wcDebug = window.__wcDebug || [];
        order.forEach(function (idx, rank) {
            var b = boxes[idx];
            // findSpot 现在保证不管多挤都会返回一个"压得最少"的位置，不会再是 null，
            // 所以也不会再退化成固定堆在正中心、被最大的词挡住看不见
            var scale = 1, pos = null;
            while (!pos && scale > 0.45) {
                pos = findSpot(b.w * scale, b.h * scale, rank * GOLDEN_ANGLE);
                if (!pos) scale -= 0.05;
            }
            if (!pos) { pos = findSpot(b.w * 0.45, b.h * 0.45, rank * GOLDEN_ANGLE); scale = 0.45; }
            positions[idx] = pos ? { left: pos.left, top: pos.top, scale: scale } : null;
            if (pos) {
                placed.push({ left: pos.left - b.w * scale / 2, top: pos.top - b.h * scale / 2, w: b.w * scale, h: b.h * scale });
            }
            window.__wcDebug.push({ idx: idx, rank: rank, w: b.w, h: b.h, pos: pos, placedCountBefore: placed.length - (pos ? 1 : 0) });
        });
        return positions;

        function overlaps(box) {
            for (var i = 0; i < placed.length; i++) {
                var p = placed[i];
                if (box.left < p.left + p.w + pad && box.left + box.w + pad > p.left &&
                    box.top < p.top + p.h + pad && box.top + box.h + pad > p.top) return true;
            }
            return false;
        }
        function findSpot(w, h, startAngle) {
            var angle = startAngle, radius = 0;
            for (var i = 0; i < 500; i++) {
                var cx = 50 + radius * Math.cos(angle);
                var cy = 50 + radius * Math.sin(angle) * 0.62;
                var box = { left: cx - w / 2, top: cy - h / 2, w: w, h: h };
                if (box.left >= 6 && box.left + w <= 94 && box.top >= 6 && box.top + h <= 92 && !overlaps(box)) {
                    return { left: cx, top: cy };
                }
                angle += 0.22;
                radius += 0.15;
            }
            // 螺旋没找到：扫全图，挑"离正中心最近"的空位兜底（通常是遗漏的边角空隙）
            var best = null, bestDist = Infinity;
            var fallback = null, fallbackOverlap = Infinity; // 万一真的一个空位都没有，也不要堆到正中心（会被最大的词挡住看不见）
            for (var gy = 6; gy <= 92 - h; gy += 2) {
                for (var gx = 6; gx <= 94 - w; gx += 2) {
                    var gbox = { left: gx, top: gy, w: w, h: h };
                    var cxg = gx + w / 2, cyg = gy + h / 2;
                    if (!overlaps(gbox)) {
                        var dist = Math.pow(cxg - 50, 2) + Math.pow(cyg - 50, 2);
                        if (dist < bestDist) { bestDist = dist; best = { left: cxg, top: cyg }; }
                    } else {
                        var overlapArea = totalOverlapArea(gbox);
                        if (overlapArea < fallbackOverlap) { fallbackOverlap = overlapArea; fallback = { left: cxg, top: cyg }; }
                    }
                }
            }
            return best || fallback; // 实在没有不重叠的位置，也要挑"压得最少"的那个位置，不能固定堆中心

            function totalOverlapArea(box) {
                var sum = 0;
                for (var i = 0; i < placed.length; i++) {
                    var p = placed[i];
                    var ox = Math.max(0, Math.min(box.left + box.w, p.left + p.w) - Math.max(box.left, p.left));
                    var oy = Math.max(0, Math.min(box.top + box.h, p.top + p.h) - Math.max(box.top, p.top));
                    sum += ox * oy;
                }
                return sum;
            }
        }
    }

    // 建一组词云：取前 N 个词，按词频算字号（指数 0.7，差距比开平方更明显），
    // 字是浅色（接近白），发光颜色按排名渐变——高频词发光更深更浓，低频词发光更淡
    function buildWordSet(rawData, darkColor, lightColor, count) {
        var words = rawData.slice(0, count);
        var maxV = words[0].value, minV = words[words.length - 1].value;
        var stageRect = stage.getBoundingClientRect();
        var rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);

        var metas = words.map(function (w, i) {
            var t = words.length > 1 ? i / (words.length - 1) : 0;
            var sizeT = maxV > minV ? Math.pow((w.value - minV) / (maxV - minV), 0.75) : 1;   // 指数提高，低频词明显更小，差距看得出来
            var fontSizeRem = 0.3 + sizeT * 0.42;   // rem 0.3 ~ 0.72，最大字号没变，只是低频词往小了压，总面积更小不会更挤
            var fontPx = fontSizeRem * rootPx;
            // 按字数估算这个词占的像素宽高，再换算成"占舞台宽/高的百分比"，给碰撞检测用
            var wPct = (words[i].name.length * fontPx * 1.18) / stageRect.width * 100;
            var hPct = (fontPx * 1.3) / stageRect.height * 100;
            return { fontSizeRem: fontSizeRem, t: t, w: wPct, h: hPct };
        });
        var positions = placeWords(metas);

        var set = document.createElement("div");
        set.className = "word-cloud-set";
        words.forEach(function (w, i) {
            if (!positions[i]) return; // 真放不下的词直接跳过不画，总比硬塞中心叠字强
            var wordColor = lerpColor(darkColor, lightColor, metas[i].t);
            var span = document.createElement("span");
            span.className = "word-cloud-item";
            span.textContent = w.name;
            span.title = w.name + "：出现 " + w.value + " 次";
            // 时长拉长到 5~11 秒（原来 4~8 秒太快，字刚看清就没了），负延迟保证一开始就是错开的状态
            var dur = (5 + Math.random() * 6).toFixed(2);
            var delay = (-Math.random() * dur).toFixed(2);
            // 真放不下时 placeWords 会把这个词的盒子缩小了才找到位置，字号也要跟着缩，不然
            // 碰撞检测算的是小盒子、实际画出来还是原尺寸，看着就跟没缩小一样会叠字
            var renderFontRem = metas[i].fontSizeRem * (positions[i].scale || 1);
            span.style.cssText =
                "left:" + positions[i].left.toFixed(2) + "%;" +
                "top:" + positions[i].top.toFixed(2) + "%;" +
                "font-size:" + renderFontRem.toFixed(3) + "rem;" +
                "z-index:" + (words.length - i) + ";" +   // 词频越高（i 越小）图层越靠上，不会被后面的字盖住
                "--glow:" + hexToRgba(wordColor, .85) + ";" +   // 字心是白的（CSS 里统一定了），这里只给边缘发光上色，按排名渐变
                "--dur:" + dur + "s;--delay:" + delay + "s;";
            set.appendChild(span);
        });
        return set;
    }
    // 好评用深青绿渐变发光，差评用深酒红渐变发光
    var goodSet = buildWordSet(wordCloud.good, "#1f6f62", "#8fc3b8", 11);   // 间距、宽高估算都放宽了，词数减到11，确保真不重叠
    var badSet = buildWordSet(wordCloud.bad, "#a8432e", "#d0725a", 11);
    goodSet.classList.add("active");
    stage.appendChild(goodSet);
    stage.appendChild(badSet);

    var panelEl = document.querySelector(".right3");
    var titleEl = document.getElementById("right3Title");
    // 只选带 data-tab 的按钮（好评/差评），"定格"按钮没有 data-tab，不会被这段逻辑误当成切 tab
    document.querySelectorAll(".right3 .tab-btn[data-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".right3 .tab-btn[data-tab]").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            var tab = btn.dataset.tab;
            titleEl.textContent = tab === "good" ? "好评高频词" : "差评高频词";
            panelEl.classList.toggle("tone-bad-bg", tab === "bad");
            goodSet.classList.toggle("active", tab === "good");
            badSet.classList.toggle("active", tab === "bad");
        });
    });

    // 定格按钮：点一下冻结全部词同时显示出来，再点一下恢复动画
    var pauseBtn = document.getElementById("right3PauseBtn");
    pauseBtn.addEventListener("click", function () {
        var paused = panelEl.classList.toggle("paused");
        pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 定格";
        pauseBtn.classList.toggle("active", paused);
    });
})();

// ========== "查看大图"全屏弹层：通用逻辑，哪个面板想要这个功能，H2 旁边加个
// <button class="view-btn" data-chart="xxx">，再在 window.chartBuilders.xxx 里注册一个
// 返回 option 的函数（接收 big 参数）就行，不用每个图表单独写一套弹层代码 ==========
(function () {
    var modal = document.getElementById("chartModal");
    var modalTitle = document.getElementById("chartModalTitle");
    var modalChartEl = document.getElementById("chartModalChart");
    var modalChart = null;

    function openModal(key, title) {
        var builder = window.chartBuilders[key];
        if (!builder) return;   // 这个面板还没注册大图 option，点了也不做任何事
        modalTitle.textContent = title;
        modal.classList.add("open");
        if (modalChart) { modalChart.dispose(); }
        modalChart = echarts.init(modalChartEl);
        modalChart.setOption(builder(true));   // true = 大图模式，字号跟着放大
    }
    function closeModal() {
        modal.classList.remove("open");
        if (modalChart) { modalChart.dispose(); modalChart = null; }
    }

    document.querySelectorAll(".view-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var panel = btn.closest(".panel");
            var title = panel.querySelector("h2").textContent;
            openModal(btn.dataset.chart, title);
        });
    });
    document.getElementById("chartModalClose").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();   // 点弹层的空白背景也能关
    });
    window.addEventListener("resize", function () {
        if (modalChart) modalChart.resize();
    });
})();
