// ============================================================
//  page2.js —— 产业健康度
//  数据来源：data/tourism.js（页面里用 <script> 引入，双击打开也能用）
//  备用：如果没引入 tourism.js，就用 fetch 读 data/tourism.json（需要 Live Server）
// ============================================================

var JSON_URL = 'data/tourism.json';

// 统一整理成 {year, tourists(万人次), revenue(亿元)}，按年份升序
function normalize(list) {
    return list.map(function (d) {
        return { year: String(d.year), tourists: d.tourists_wan, revenue: d.revenue_yi, inbound: d.inbound_wan };
    }).sort(function (a, b) { return a.year < b.year ? -1 : 1; });
}

// 只加载一次，后面的图表（瀑布图、相图）直接复用这份数据
var yearlyPromise = null;
function getYearlyData() {
    if (!yearlyPromise) {
        if (window.TOURISM_DATA) {
            yearlyPromise = Promise.resolve(normalize(window.TOURISM_DATA));
        } else {
            yearlyPromise = fetch(JSON_URL)
                .then(function (res) {
                    if (!res.ok) { throw new Error('读取失败 ' + res.status + '：' + JSON_URL); }
                    return res.json();
                })
                .then(normalize);
        }
    }
    return yearlyPromise;
}

// ---------- 报错时直接显示在图表框里，方便排查 ----------
function showError(dom, err) {
    console.error(err);
    var tip = (location.protocol === 'file:')
        ? '没有找到数据：请确认 page2.html 里已引入 data/tourism.js（在 page2.js 之前），或用 Live Server 打开页面'
        : err.message;
    dom.innerHTML = '<div style="padding:20px;color:#8c1c2b;font-size:13px;line-height:1.6;">图表加载失败：' + tip + '</div>';
}

$(document).ready(function () {
    var charts = [];

    // ================= 1. 左上：增速“剪刀差”面积图 =================
    var domScissors = document.getElementById('chart-scissors');
    var chartScissors = echarts.init(domScissors);
    charts.push(chartScissors);

    getYearlyData().then(function (data) {
        // 同比增速 (%)：第一年没有上一年可比，所以从第二年开始
        var years = [], touristGrowth = [], revenueGrowth = [], gap = [], warnPoints = [];
        for (var i = 1; i < data.length; i++) {
            var tg = +((data[i].tourists - data[i - 1].tourists) / data[i - 1].tourists * 100).toFixed(1);
            var rg = +((data[i].revenue - data[i - 1].revenue) / data[i - 1].revenue * 100).toFixed(1);
            years.push(data[i].year);
            touristGrowth.push(tg);
            revenueGrowth.push(rg);
            gap.push(+(rg - tg).toFixed(1)); // 剪刀差 = 收入增速 - 游客增速
            if (rg < tg) { warnPoints.push({ coord: [data[i].year, rg] }); } // 增量不增收
        }

        chartScissors.setOption({
            title: {
                text: '客流与收入同比增速 (剪刀差诊断)',
                subtext: '○ 红圈：收入增速低于游客增速（人均消费下滑）',
                textStyle: { color: '#0f2d3a', fontSize: 20, fontWeight: 'bolder', fontFamily: 'sans-serif' },
                subtextStyle: { color: '#8c1c2b', fontSize: 14, fontWeight: 'bolder' },
                top: 12,
                left: 15
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255,255,255,0.85)',
                borderColor: '#6b7f8a',
                textStyle: { color: '#2a3a44' },
                formatter: function (params) {
                    var g = gap[params[0].dataIndex];
                    var gapText = g >= 0
                        ? '<span style="color:#1e3f6e;font-weight:bold;">收入领先 ' + g + ' 个百分点</span>'
                        : '<span style="color:#8c1c2b;font-weight:bold;">收入落后 ' + Math.abs(g) + ' 个百分点（人均消费下滑）</span>';
                    var html = '<div style="font-weight:bold;margin-bottom:5px;">' + params[0].name + '年 增速对比</div>';
                    params.forEach(function (p) {
                        html += p.marker + ' ' + p.seriesName + ': <span style="font-weight:bold;">' + p.value + '%</span><br>';
                    });
                    return html + gapText;
                }
            },
            legend: {
                data: ['游客增速(%)', '收入增速(%)'],
                top: 82,
                left: 15,
                icon: 'circle',
                textStyle: { color: '#1c3641', fontSize: 15, fontWeight: 'bolder' }
            },
            grid: { left: '15%', right: '10%', bottom: '12%', top: '40%' },
            xAxis: {
                type: 'category',
                data: years,
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#2a3a44' } },
                axisLabel: { color: '#1c3641', fontSize: 15, fontWeight: 'bolder' }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { type: 'dashed', color: 'rgba(28,54,65,0.35)' } },
                axisLabel: { color: '#1c3641', fontSize: 15, fontWeight: 'bolder', formatter: '{value} %' }
            },
            series: [
                {
                    name: '游客增速(%)',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 3, shadowColor: 'rgba(30, 63, 110, .6)', shadowBlur: 10 },
                    itemStyle: { color: '#1e3f6e' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(30, 63, 110, 0.9)' },
                            { offset: 1, color: 'rgba(30, 63, 110, 0.2)' }
                        ])
                    },
                    data: touristGrowth
                },
                {
                    name: '收入增速(%)',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 3, shadowColor: 'rgba(184, 134, 42, .6)', shadowBlur: 10 },
                    itemStyle: { color: '#b8862a' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(184, 134, 42, 0.9)' },
                            { offset: 1, color: 'rgba(184, 134, 42, 0.2)' }
                        ])
                    },
                    markPoint: {
                        symbol: 'circle',
                        symbolSize: 12,
                        silent: true,
                        itemStyle: { color: 'transparent', borderColor: '#8c1c2b', borderWidth: 2 },
                        label: { show: false },
                        data: warnPoints
                    },
                    data: revenueGrowth
                }
            ]
        });
    }).catch(function (err) {
        showError(domScissors, err);
    });
    // ================= 2. 左下：人均消费演变瀑布图 =================
    var domWaterfall = document.getElementById('chart-revenue-structure');
    var chartWaterfall = echarts.init(domWaterfall);
    charts.push(chartWaterfall);
 
    getYearlyData().then(function (data) {
        // 人均消费(元) = 旅游总收入(亿元) ÷ 接待游客(万人次) × 10000
        var per = data.map(function (d) { return Math.round(d.revenue / d.tourists * 10000); });
        var n = data.length;
 
        var COLOR_TOTAL = '#1b3a6b'; // 深蓝：人均消费合计
        var COLOR_UP = '#13875a';    // 深绿：较上年增加
        var COLOR_DOWN = '#d63a22';  // 朱红：较上年减少
 
        var cats = [], base = [], totalBar = [], upBar = [], downBar = [], tops = [], deltas = [];
        for (var i = 0; i <= n; i++) {
            if (i === 0 || i === n) {
                // 头尾两根是“合计柱”：从 0 开始的完整柱子
                var v = (i === 0) ? per[0] : per[n - 1];
                var y = (i === 0) ? data[0].year : data[n - 1].year;
                cats.push(y + '\n人均');
                base.push(0);
                totalBar.push(v);
                upBar.push('-');
                downBar.push('-');
                tops.push({ value: v, text: String(v), label: { color: COLOR_TOTAL } });
                deltas.push(null);
            } else {
                // 中间是“增减柱”：悬空在上一年的高度上，长度是净增减额
                var d = per[i] - per[i - 1];
                cats.push(data[i].year);
                base.push(Math.min(per[i - 1], per[i]));
                totalBar.push('-');
                upBar.push(d > 0 ? d : '-');
                downBar.push(d < 0 ? -d : '-');
                tops.push({
                    value: Math.max(per[i - 1], per[i]),
                    text: (d > 0 ? '+' : '') + d,
                    label: { color: d >= 0 ? COLOR_UP : COLOR_DOWN }
                });
                deltas.push(d);
            }
        }
 
        var totalChange = per[n - 1] - per[0];
        var totalPct = (totalChange / per[0] * 100).toFixed(1);
        var summary = data[0].year + '年 ' + per[0] + ' 元 → ' + data[n - 1].year + '年 ' + per[n - 1] + ' 元，累计 '
            + (totalChange >= 0 ? '+' : '') + totalChange + ' 元（' + (totalChange >= 0 ? '+' : '') + totalPct + '%）';
 
        chartWaterfall.setOption({
            title: {
                text: '人均消费演变 (元/人)',
                subtext: summary + '\n深蓝：人均消费　深绿：较上年增加　朱红：较上年减少',
                textStyle: { color: '#1d4a3e', fontSize: 17, fontWeight: 'bolder', fontFamily: 'sans-serif', textShadowColor: 'rgba(34, 163, 147, .55)', textShadowBlur: 8 },
                subtextStyle: { color: '#1d4a3e', fontSize: 12, fontWeight: 'bold', lineHeight: 18 },
                top: 12,
                left: 15
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderColor: '#a3b5c1',
                textStyle: { color: '#4a5a68' },
                formatter: function (params) {
                    if (!params || !params.length) { return ''; }
                    var idx = params[0].dataIndex;
                    var year = (idx === n) ? data[n - 1].year : data[idx].year;
                    var html = '<div style="font-weight:bold;margin-bottom:5px;">' + year + '年</div>';
                    html += '人均消费：<span style="font-weight:bold;">' + ((idx === n) ? per[n - 1] : per[idx]) + '</span> 元';
                    if (idx > 0 && idx < n) {
                        var d = deltas[idx];
                        var pct = (d / per[idx - 1] * 100).toFixed(1);
                        var color = d >= 0 ? COLOR_UP : COLOR_DOWN;
                        html += '<br>较上年：<span style="color:' + color + ';font-weight:bold;">' + (d >= 0 ? '+' : '') + d + ' 元（' + (d >= 0 ? '+' : '') + pct + '%）</span>';
                    }
                    return html;
                }
            },
            grid: { left: '13%', right: '5%', bottom: '14%', top: '34%' },
            xAxis: {
                type: 'category',
                data: cats,
                axisTick: { show: false },
                axisLine: { lineStyle: { color: '#4a5a68' } },
                axisLabel: { color: '#1d4a3e', fontSize: 11, fontWeight: 'bold', interval: 0 }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { type: 'dashed', color: 'rgba(47,74,66,0.2)' } },
                axisLabel: { color: '#1d4a3e', fontSize: 12, fontWeight: 'bold' }
            },
            series: [
                {   // 透明底座：把增减柱“托”在半空
                    name: '底座',
                    type: 'bar',
                    stack: 'wf',
                    itemStyle: { color: 'transparent' },
                    emphasis: { itemStyle: { color: 'transparent' } },
                    data: base
                },
                {
                    name: '人均消费',
                    type: 'bar',
                    stack: 'wf',
                    barWidth: '58%',
                    itemStyle: { color: COLOR_TOTAL, borderRadius: [4, 4, 0, 0] },
                    data: totalBar
                },
                {
                    name: '增加',
                    type: 'bar',
                    stack: 'wf',
                    itemStyle: { color: COLOR_UP, borderRadius: [3, 3, 0, 0] },
                    data: upBar
                },
                {
                    name: '减少',
                    type: 'bar',
                    stack: 'wf',
                    itemStyle: { color: COLOR_DOWN, borderRadius: [3, 3, 0, 0] },
                    data: downBar
                },
                {   // 只用来在每根柱子顶上显示数字，线本身是透明的
                    name: '数值标签',
                    type: 'line',
                    symbol: 'none',
                    silent: true,
                    lineStyle: { opacity: 0 },
                    label: {
                        show: true,
                        position: 'top',
                        fontSize: 11,
                        fontWeight: 'bold',
                        formatter: function (p) { return p.data.text; }
                    },
                    z: 5,
                    data: tops
                }
            ]
        });
    }).catch(function (err) {
        showError(domWaterfall, err);
    });
    // ================= 3. 中间 C位：产业健康度综合诊断（五维雷达 + 淡旺季落差） =================
    var domCore = document.getElementById('chart-core');
    var chartCore = echarts.init(domCore);
    charts.push(chartCore);

    getYearlyData().then(function (data) {
        var M = window.monthReview || (typeof monthReview !== 'undefined' ? monthReview : null);
        if (!M) { throw new Error('没有找到 monthReview：请确认 page2.html 里已引入 data/monthReview.js'); }

        // ---------- 一、五个维度：每年算一组原始值 ----------
        var per = data.map(function (d) { return d.revenue / d.tourists * 10000; });
        var growth = data.map(function (d, i) { return i === 0 ? null : (d.revenue - data[i - 1].revenue) / data[i - 1].revenue * 100; });
        var share = data.map(function (d) { return (d.inbound === null || d.inbound === undefined) ? null : d.inbound / d.tourists * 100; });
        function valid(a) { return a.filter(function (x) { return x !== null; }); }
        var maxT = Math.max.apply(null, data.map(function (d) { return d.tourists; }));
        var maxR = Math.max.apply(null, data.map(function (d) { return d.revenue; }));
        var maxP = Math.max.apply(null, per);
        var maxS = Math.max.apply(null, valid(share));
        var minG = Math.min.apply(null, valid(growth)), maxG = Math.max.apply(null, valid(growth));

        var DIMS = ['客流规模', '营收规模', '单客价值', '增长动能', '国际化'];
        // 得分 0–100：前三项和国际化 = 该年数值 ÷ 2014–2024 年最高值；增长动能 = 收入同比在历史区间里的位置
        function scores(i) {
            return [
                data[i].tourists / maxT * 100,
                data[i].revenue / maxR * 100,
                per[i] / maxP * 100,
                growth[i] === null ? 0 : (growth[i] - minG) / (maxG - minG) * 100,
                share[i] === null ? 0 : share[i] / maxS * 100
            ].map(function (v) { return Math.round(v); });
        }
        function overall(sc) { return Math.round(sc.reduce(function (a, b) { return a + b; }, 0) / sc.length); }
        function rawText(i) {
            return [
                data[i].tourists + ' 万人次',
                data[i].revenue + ' 亿元',
                Math.round(per[i]) + ' 元/人',
                growth[i] === null ? '无' : '收入同比 ' + (growth[i] >= 0 ? '+' : '') + growth[i].toFixed(1) + '%',
                share[i] === null ? '官方无数据' : '入境占比 ' + share[i].toFixed(1) + '%'
            ];
        }

        // 对比三个年份：疫情前、复苏起步、最新
        var PICK = [
            { year: '2019', tag: '2019 年（疫情前）', color: '#1e3f6e' },
            { year: '2023', tag: '2023 年', color: '#b8862a' },
            { year: '2024', tag: '2024 年', color: '#13875a' }
        ].filter(function (p) { return data.some(function (d) { return d.year === p.year; }); });
        PICK.forEach(function (p) {
            p.i = data.map(function (d) { return d.year; }).indexOf(p.year);
            p.sc = scores(p.i);
            p.total = overall(p.sc);
        });
        var latest = PICK[PICK.length - 1];
        var best = latest.sc.indexOf(Math.max.apply(null, latest.sc));
        var worst = latest.sc.indexOf(Math.min.apply(null, latest.sc));

        // ---------- 二、淡旺季：最旺的 3 个月标红 ----------
        var top3 = M.count.slice().sort(function (a, b) { return b - a; }).slice(0, 3);
        var barData = M.share.map(function (s, i) {
            return { value: s, itemStyle: { color: top3.indexOf(M.count[i]) >= 0 ? '#d63a22' : '#1e3f6e', borderRadius: [4, 4, 0, 0] } };
        });
        var even = +(100 / 12).toFixed(1);

        var DARK = '#0f2d3a';
        var graphics = [
            { type: 'text', left: '60%', top: '17%', style: { text: '综合健康指数（满分 100）', font: 'bolder 17px sans-serif', fill: DARK } }
        ];
        PICK.forEach(function (p, k) {
            var top = (24 + k * 9) + '%';
            graphics.push({ type: 'text', left: '60%', top: top, style: { text: p.tag, font: 'bolder 16px sans-serif', fill: p.color } });
            graphics.push({ type: 'text', left: '86%', top: (23 + k * 9) + '%', style: { text: String(p.total), font: 'bolder 34px sans-serif', fill: p.color } });
        });
        graphics.push({ type: 'text', left: '60%', top: '52%', style: { text: latest.year + ' 年强项：' + DIMS[best] + ' ' + latest.sc[best] + ' 分\n' + latest.year + ' 年短板：' + DIMS[worst] + ' ' + latest.sc[worst] + ' 分', font: 'bold 14px sans-serif', fill: DARK, lineHeight: 22 } });

        chartCore.setOption({
            title: [
                {
                    text: '产业健康度综合诊断',
                    subtext: '五维体质雷达 × 淡旺季结构　各维度以 2014–2024 年历史最高 = 100，五项等权平均',
                    textStyle: { color: DARK, fontSize: 22, fontWeight: 'bolder', fontFamily: 'sans-serif' },
                    subtextStyle: { color: '#13875a', fontSize: 13, fontWeight: 'bold' },
                    top: 5,
                    left: 'center'
                },
                {
                    text: '淡旺季落差：各月评价量占全年比例 (%)',
                    subtext: '峰谷比 ' + M.peak_ratio + ' : 1　最旺 3 个月占 ' + M.top3_share + '%　好评率 ' + M.good_rate + '%',
                    textStyle: { color: DARK, fontSize: 16, fontWeight: 'bolder' },
                    subtextStyle: { color: '#1c3641', fontSize: 12, fontWeight: 'bold' },
                    top: '63%',
                    left: '6%'
                }
            ],
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#6b7f8a',
                borderWidth: 1,
                padding: 12,
                textStyle: { color: '#2a3a44' },
                formatter: function (p) {
                    if (p.seriesType === 'bar') {
                        return '<b>' + p.name + '</b><br>评价量：' + M.count[p.dataIndex] + ' 条　占比 <b>' + p.value + '%</b>';
                    }
                    var pk = PICK[p.seriesIndex === 0 ? p.dataIndex : 0];
                    var html = '<div style="font-weight:bolder;font-size:15px;margin-bottom:6px;color:' + pk.color + ';">' + pk.tag + '　综合 ' + pk.total + ' 分</div>';
                    var raw = rawText(pk.i);
                    DIMS.forEach(function (n, j) {
                        html += n + '：<b>' + pk.sc[j] + '</b> 分　<span style="color:#6b7f8a;">' + raw[j] + '</span><br>';
                    });
                    return html;
                }
            },
            legend: { data: PICK.map(function (p) { return p.tag; }), top: '12%', left: '6%', icon: 'circle', itemGap: 18, textStyle: { color: DARK, fontSize: 14, fontWeight: 'bolder' } },
            radar: {
                center: ['30%', '41%'],
                radius: '40%',
                splitNumber: 4,
                indicator: DIMS.map(function (n) { return { name: n.length === 4 ? n.slice(0, 2) + '\n' + n.slice(2) : n, max: 100 }; }),
                name: { textStyle: { color: '#000000', fontSize: 12, fontWeight: 'bolder' } },
                axisLine: { lineStyle: { color: 'rgba(28,54,65,0.45)' } },
                splitLine: { lineStyle: { color: 'rgba(28,54,65,0.35)' } },
                splitArea: { areaStyle: { color: ['rgba(255,255,255,0.35)', 'rgba(28,54,65,0.06)'] } }
            },
            grid: { left: '6%', right: '6%', top: '73%', height: '15%' },
            xAxis: {
                type: 'category',
                data: M.month,
                axisLine: { lineStyle: { color: '#2a3a44' } },
                axisTick: { show: false },
                axisLabel: { color: '#1c3641', fontSize: 13, fontWeight: 'bolder', interval: 0 }
            },
            yAxis: { type: 'value', show: false, max: Math.ceil(Math.max.apply(null, M.share) * 1.35) },
            series: [
                {
                    type: 'radar',
                    symbol: 'circle',
                    symbolSize: 7,
                    data: PICK.map(function (p, k) {
                        return {
                            name: p.tag,
                            value: p.sc,
                            lineStyle: { color: p.color, width: 3 },
                            itemStyle: { color: p.color },
                            areaStyle: { color: p.color, opacity: k === PICK.length - 1 ? 0.28 : 0.12 },
                            label: { show: k === PICK.length - 1, color: p.color, fontSize: 13, fontWeight: 'bolder', formatter: function (o) { return o.value; } }
                        };
                    })
                },
                {
                    type: 'bar',
                    barWidth: '55%',
                    data: barData,
                    label: { show: true, position: 'top', color: DARK, fontSize: 12, fontWeight: 'bolder', formatter: '{c}%' },
                    markLine: {
                        silent: true, symbol: 'none',
                        lineStyle: { color: '#8c1c2b', type: 'dashed', width: 1.5 },
                        label: { show: true, formatter: '均衡线 ' + even + '%', color: '#8c1c2b', fontWeight: 'bold', fontSize: 12, position: 'insideEndTop' },
                        data: [{ yAxis: even }]
                    }
                }
            ],
            graphic: { elements: graphics }
        });
    }).catch(function (err) {
        showError(domCore, err);
    });
      // ================= 4. 右上：旅游总收入排位赛 =================
    var domRank = document.getElementById('chart-source');
    var chartRank = echarts.init(domRank);
    charts.push(chartRank);
 
    getYearlyData().then(function (data) {
        var STEP = 1200;        // 每揭晓一年停留(ms)
        var LOOP_PAUSE = 4000;  // 11 年揭晓完后停多久再重播(ms)
        var C_BEFORE = '#1e3f6e';  // 黛蓝：2019 及以前
        var C_COVID = '#8c1c2b';   // 绛红：2020–2022
        var C_RECOVER = '#1f5a4a'; // 墨绿：2023 年起
        function phaseColor(y) { y = Number(y); return y <= 2019 ? C_BEFORE : (y <= 2022 ? C_COVID : C_RECOVER); }
 
        var n = data.length;
        var years = data.map(function (d) { return d.year; });
        var rev = data.map(function (d) { return d.revenue; });
        var xMax = Math.ceil(Math.max.apply(null, rev) * 1.12 / 100) * 100;
 
        // realtimeSort 需要 ECharts 5.2+，版本低就自己排序
        var ver = String(echarts.version || '5.0.0').split('.');
        var canSort = Number(ver[0]) > 5 || (Number(ver[0]) === 5 && Number(ver[1]) >= 2);
 
        // 第 k 帧：已经揭晓 0..k 年，没揭晓的年份先是 0；柱子会按收入高低自动换位
        function frame(k) {
            var rows = years.map(function (y, i) { return { name: y, v: i <= k ? rev[i] : 0, i: i }; });
            var rank = 1, best = 0;
            for (var i = 0; i <= k; i++) {
                if (rev[i] > rev[k]) { rank++; }
                if (rev[i] > rev[best]) { best = i; }
            }
            if (!canSort) { rows.sort(function (a, b) { return (b.v - a.v) || (a.i - b.i); }); }
            return {
                year: years[k],
                names: rows.map(function (r) { return r.name; }),
                data: rows.map(function (r) {
                    return { value: r.v, itemStyle: { color: phaseColor(r.name), borderRadius: [0, 4, 4, 0],
                             shadowColor: 'rgba(0,0,0,0.35)', shadowBlur: r.i === k ? 14 : 0 } };
                }),
                subtext: years[k] + '年 ' + rev[k] + ' 亿元，目前排第 ' + rank + '（已揭晓 ' + (k + 1) + ' 年）\n当前最高：' + years[best] + '年 ' + rev[best] + ' 亿元'
            };
        }
 
        var first = frame(0);
        chartRank.setOption({
            title: {
                text: '旅游总收入排位赛 (亿元)',
                subtext: first.subtext,
                textStyle: { color: '#fdfbf5', fontSize: 17, fontWeight: 'bolder', fontFamily: 'sans-serif', textShadowColor: 'rgba(29, 74, 62, .85)', textShadowBlur: 10 },
                subtextStyle: { color: '#1d4a3e', fontSize: 12, fontWeight: 'bold', lineHeight: 18 },
                top: 12,
                left: 15
            },
            grid: { left: '14%', right: '13%', top: '27%', bottom: '5%' },
            xAxis: {
                max: xMax,
                axisLabel: { color: '#1d4a3e', fontSize: 11, fontWeight: 'bold' },
                splitLine: { lineStyle: { type: 'dashed', color: 'rgba(47,74,66,0.2)' } }
            },
            yAxis: {
                type: 'category',
                data: canSort ? years : first.names,
                inverse: true,
                axisTick: { show: false },
                axisLine: { lineStyle: { color: '#4a5a68' } },
                axisLabel: { color: '#1d4a3e', fontSize: 12, fontWeight: 'bold', formatter: function (v) { return v + '年'; } },
                animationDuration: 300,
                animationDurationUpdate: 300
            },
            series: [{
                type: 'bar',
                realtimeSort: canSort,
                barCategoryGap: '22%',
                data: first.data,
                label: {
                    show: true,
                    position: 'right',
                    valueAnimation: true,
                    color: '#1d4a3e',
                    fontSize: 12,
                    fontWeight: 'bold',
                    formatter: function (p) { return p.value > 0 ? (Math.round(p.value * 10) / 10) + ' 亿' : ''; }
                }
            }],
            graphic: {
                elements: [
                    { id: 'rankYear', type: 'text', right: 22, bottom: 30, z: 0,
                      style: { text: first.year, font: 'bolder 56px sans-serif', fill: 'rgba(29,74,62,0.2)' } },
                    { id: 'rankHint', type: 'text', left: 15, bottom: 6, z: 0,
                      style: { text: '点击图表：暂停 / 继续', font: '11px sans-serif', fill: 'rgba(29,74,62,0.55)' } }
                ]
            },
            animationDuration: 0,
            animationDurationUpdate: 900,
            animationEasing: 'linear',
            animationEasingUpdate: 'cubicOut'
        });
 
        // 按年份依次揭晓，播完停一会儿再重来；点击图表可暂停
        var k = 0, paused = false;
        function next() {
            var wait = (k === n - 1) ? LOOP_PAUSE : STEP;
            setTimeout(function () {
                if (paused) { next(); return; }
                k = (k + 1) % n;
                var f = frame(k);
                chartRank.setOption({
                    title: { subtext: f.subtext },
                    yAxis: { data: canSort ? years : f.names },
                    series: [{ data: f.data }],
                    graphic: { elements: [{ id: 'rankYear', style: { text: f.year } }] }
                });
                next();
            }, wait);
        }
        next();
        chartRank.getZr().on('click', function () { paused = !paused; });
    }).catch(function (err) {
        showError(domRank, err);
    });
    // ================= 5. 右下：大盘总数主线与结构透视组合图（播放头逐年扫描高亮） =================
    var domInbound = document.getElementById('chart-inbound');
    var chartInbound = echarts.init(domInbound);
    charts.push(chartInbound);

    getYearlyData().then(function (data) {
        var STEP = 1800;        // 播放头停留在每年的时间(ms)
        var LOOP_PAUSE = 3000;  // 扫完一轮后停多久再从头开始(ms)

        var years = [], domestic = [], inbound = [], totals = [];
        data.forEach(function (d) {
            years.push(d.year);
            var inb = (d.inbound === null || d.inbound === undefined) ? 0 : d.inbound;
            domestic.push(d.tourists - inb);
            inbound.push(inb);
            totals.push(d.tourists);
        });
        var n = years.length;

        // 播放头所在年份的提示文字（标题副文本）
        function subtextFor(k) {
            var tot = totals[k], dom = domestic[k], inb = inbound[k];
            var inbRate = tot > 0 ? (inb / tot * 100).toFixed(1) : 0;
            return '▶ ' + years[k] + '年：总客流 ' + tot.toFixed(1) + ' 万人次\n国内 ' + dom.toFixed(1) + ' 万　入境 '
                + (inb === 0 ? '暂无数据' : inb + ' 万（' + inbRate + '%）');
        }
        // 当前年份在某条线上的高亮圆环（白底+系列自身颜色描边+发光）
        function markPointFor(k, arr, color) {
            return [{
                coord: [years[k], arr[k]],
                symbol: 'circle',
                symbolSize: 18,
                itemStyle: { color: '#fff', borderColor: color, borderWidth: 3, shadowColor: color, shadowBlur: 10 },
                label: { show: false }
            }];
        }

        chartInbound.setOption({
            title: {
                text: '客流总大盘与结构透视',
                subtext: subtextFor(0),
                textStyle: { color: '#0f2d3a', fontSize: 17, fontWeight: 'bolder', fontFamily: 'sans-serif' },
                subtextStyle: { color: '#13875a', fontSize: 12, fontWeight: 'bold', lineHeight: 16 },
                top: 10, left: 15
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#6b7f8a', borderWidth: 1, padding: 12,
                formatter: function (params) {
                    var idx = params[0].dataIndex;
                    var tot = totals[idx];
                    var dom = domestic[idx];
                    var inb = inbound[idx];
                    var inbRate = tot > 0 ? (inb / tot * 100).toFixed(1) : 0;

                    var html = '<div style="font-weight:bolder;border-bottom:1px solid #ccc;padding-bottom:5px;margin-bottom:6px;color:#1e3f6e;">' + years[idx] + '年 核心客流体检</div>';
                    html += '总客流大盘: <b style="color:#1e3f6e;font-size:16px;">' + tot.toFixed(1) + '</b> 万人次<br>';
                    html += '<span style="color:#4a5a68">├─ 国内游客:</span> <b>' + dom.toFixed(1) + '</b> 万人次<br>';
                    html += '<span style="color:#b8862a">└─ 入境游客:</span> <b style="color:' + (inb === 0 ? '#d63a22' : '#b8862a') + '">' + (inb === 0 ? '暂无数据' : inb + ' 万人次') + '</b><br>';
                    html += '<div style="margin-top:6px;padding-top:5px;border-top:1px dashed #ccc;font-size:12px;color:#13875a;">结构辅助观察：入境渗透率 <b>' + inbRate + '%</b></div>';
                    return html;
                }
            },
            legend: {
                data: ['总客流大盘', '国内游客', '入境游客'],
                top: 80, left: 15,
                textStyle: { fontWeight: 'bold', color: '#1c3641', fontSize: 11 },
                icon: 'roundRect'
            },
            grid: { left: '12%', right: '10%', top: '44%', bottom: '15%' },
            xAxis: {
                type: 'category',
                data: years,
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#2a3a44' } },
                axisLabel: { color: '#1c3641', fontWeight: 'bold', fontSize: 11 }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '总/国内 (万人次)',
                    nameTextStyle: { color: '#1e3f6e', fontWeight: 'bold', fontSize: 11 },
                    splitLine: { lineStyle: { type: 'dashed', color: 'rgba(28,54,65,0.1)' } },
                    axisLabel: { color: '#1e3f6e', fontWeight: 'bold', fontSize: 11 }
                },
                {
                    type: 'value',
                    name: '入境游 (万人次)',
                    nameTextStyle: { color: '#b8862a', fontWeight: 'bold', fontSize: 11 },
                    splitLine: { show: false },
                    axisLabel: { color: '#b8862a', fontWeight: 'bold', fontSize: 11 }
                }
            ],
            series: [
                // 1. 国内游客底座（左轴，柱状图展现结构分层）
                {
                    name: '国内游客',
                    type: 'bar',
                    yAxisIndex: 0,
                    barWidth: '45%',
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(74,90,104,0.15)' },
                            { offset: 1, color: 'rgba(74,90,104,0.5)' }
                        ]),
                        borderRadius: [3, 3, 0, 0]
                    },
                    data: domestic
                },
                // 2. 总客流大盘（左轴，最显眼的流光主曲线，代表绝对主角）
                {
                    name: '总客流大盘',
                    type: 'line',
                    yAxisIndex: 0,
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 7,
                    lineStyle: { width: 3.5, color: '#1e3f6e', shadowColor: 'rgba(30,63,110,0.4)', shadowBlur: 8 },
                    itemStyle: { color: '#1e3f6e', borderColor: '#fff', borderWidth: 2 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(30,63,110,0.3)' },
                            { offset: 1, color: 'rgba(30,63,110,0)' }
                        ])
                    },
                    // 移动的"播放头"竖线，随年份逐年右移
                    markLine: {
                        symbol: 'none',
                        silent: true,
                        animationDurationUpdate: 700,
                        lineStyle: { color: '#8c1c2b', type: 'dashed', width: 2 },
                        label: { show: true, formatter: function (p) { return p.data.xAxis + '年'; }, color: '#8c1c2b', fontWeight: 'bold', fontSize: 12, position: 'end' },
                        data: [{ xAxis: years[0] }]
                    },
                    // 当前年份在总客流线上的高亮圆环
                    markPoint: {
                        silent: true,
                        animationDurationUpdate: 700,
                        data: markPointFor(0, totals, '#1e3f6e')
                    },
                    data: totals
                },
                // 3. 入境游客（右轴独立展示，作为国际化结构辅助线）
                {
                    name: '入境游客',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    symbol: 'diamond',
                    symbolSize: 7,
                    lineStyle: { width: 2.5, color: '#b8862a', type: 'dashed' },
                    itemStyle: { color: '#b8862a' },
                    // 当前年份在入境游客线上的高亮圆环
                    markPoint: {
                        silent: true,
                        animationDurationUpdate: 700,
                        data: markPointFor(0, inbound, '#b8862a')
                    },
                    data: inbound
                }
            ],
            graphic: {
                elements: [
                    { id: 'inboundYear', type: 'text', right: 22, bottom: 30, z: 0,
                      style: { text: years[0], font: 'bolder 56px sans-serif', fill: 'rgba(29,74,62,0.18)' } },
                    { id: 'inboundHint', type: 'text', left: 15, bottom: 6, z: 0,
                      style: { text: '点击图表：暂停 / 继续', font: '11px sans-serif', fill: 'rgba(29,74,62,0.55)' } }
                ]
            }
        });

        // 播放头逐年扫描：竖线+高亮圆环移动到下一年，播完停一会儿再从头开始；点击图表可暂停
        var k = 0, paused = false;
        function next() {
            var wait = (k === n - 1) ? LOOP_PAUSE : STEP;
            setTimeout(function () {
                if (paused) { next(); return; }
                k = (k + 1) % n;
                chartInbound.setOption({
                    title: { subtext: subtextFor(k) },
                    series: [
                        {},
                        { markLine: { data: [{ xAxis: years[k] }] }, markPoint: { data: markPointFor(k, totals, '#1e3f6e') } },
                        { markPoint: { data: markPointFor(k, inbound, '#b8862a') } }
                    ],
                    graphic: { elements: [{ id: 'inboundYear', style: { text: years[k] } }] }
                });
                next();
            }, wait);
        }
        next();
        chartInbound.getZr().on('click', function () { paused = !paused; });
    }).catch(function (err) {
        showError(domInbound, err);
    });

    // 窗口大小变化时，所有图表自适应（后面新图表 push 进 charts 即可）
    window.addEventListener('resize', function () {
        charts.forEach(function (c) { c.resize(); });
    });
});

