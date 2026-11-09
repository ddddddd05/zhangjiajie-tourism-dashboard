/* ==========================================================
   张家界文旅大屏 - 页面三：左上角「差评原因玫瑰图」，按景点切换
   数据：data/badReasonCount.js（真实关键词分类统计，bySpot）
   ================================================---------- */

$(document).ready(function () {
    if (typeof badReasonCount === 'undefined') {
        console.error('差评原因玫瑰图：缺少 badReasonCount，请检查 page3.html 是否引入了 data/badReasonCount.js');
        return;
    }

    const chartLeft = echarts.init(document.getElementById('panelTopLeft'));

    // 和③河流图共用同一套"舆情主题"口径，颜色也保持一致，方便跨图对照
    const CATS = ['排队拥挤', '价格性价比', '服务态度', '天气能见度', '票务问题', '额外收费'];
    const CAT_COLOR = {
        '排队拥挤': '#8c1c2b',
        '价格性价比': '#b8862a',
        '服务态度': '#5b2a4a',
        '天气能见度': '#1e3f6e',
        '票务问题': '#1f5a4a',
        '额外收费': '#6b7280'
    };
    const CREAM = '#f5ecd9';

    const spotNames = Object.keys(badReasonCount.bySpot);
    let currentIndex = 0;
    let autoPlayTimer = null;
    let currentMode = 'rose'; // 'rose' = 差评原因玫瑰图，'word' = 差评关键词词云

    // 0. 模式切换：玫瑰图（原因分类）/ 词云（具体关键词），两个小标签放标题正下方
    function initModeToggle() {
        if ($('#roseModeToggle').length === 0) {
            $('#panelTopLeft').append(`
                <div id="roseModeToggle" style="position: absolute; bottom: 14px; left: 14px; display: flex; gap: 6px; z-index: 99;">
                    <div class="rose-mode-btn active" data-mode="rose" style="
                        padding: 3px 9px; border-radius: 10px; font-size: 11px; font-weight: bold; cursor: pointer;
                        color: #f0ebdd; background: rgba(15,22,20,0.75); border: 1px solid rgba(214,190,140,0.7);">原因分类</div>
                    <div class="rose-mode-btn" data-mode="word" style="
                        padding: 3px 9px; border-radius: 10px; font-size: 11px; font-weight: bold; cursor: pointer;
                        color: #f0ebdd; background: rgba(15,22,20,0.75); border: 1px solid rgba(214,190,140,0.7);">差评关键词</div>
                </div>
            `);
        }
        $('.rose-mode-btn').on('click', function () {
            currentMode = $(this).data('mode');
            $('.rose-mode-btn').css({ background: 'rgba(15,22,20,0.75)', color: '#f0ebdd' });
            $(this).css({ background: '#8c1c2b', color: '#fff' });
            renderPanel(spotNames[currentIndex]);
        });
    }

    // 1. 右侧做一整列 flex 容器：上半部分放切换按钮，下半部分放图例（自己画，不用 ECharts 的 legend，
    //    这样两块是同一个 flex 布局算出来的，不会再互相挡住）
    function initController() {
        if ($('#topLeftController').length === 0) {
            $('#panelTopLeft').css('position', 'relative').append(`
                <div id="topLeftController" style="
                    position: absolute; top: 8px; right: 12px; bottom: 8px; width: 258px;
                    display: flex; flex-direction: row; gap: 12px; z-index: 99;">
                    <div id="roseLegendGroup" style="flex: 0 0 106px; display: flex; flex-direction: column; justify-content: center; gap: 12px;"></div>
                    <div id="spotBtnGroup" style="flex: 0 0 140px; display: flex; flex-direction: column; justify-content: center; gap: 8px;"></div>
                </div>
            `);
        }

        // 按钮用短名字，窄栏里才能一行放下，不然两行文字会把布局撑高
        const SHORT_NAME = {
            '天门山国家森林公园': '天门山',
            '张家界国家森林公园': '森林公园',
            '张家界大峡谷玻璃桥': '大峡谷玻璃桥',
            '黄龙洞': '黄龙洞',
            '宝峰湖': '宝峰湖'
        };
        const btnHtml = spotNames.map((name) => `
            <div class="spot-btn-item" data-name="${name}" style="
                padding: 7px 8px; color: #f0ebdd; background: rgba(255,255,255,0.1);
                border: 1px solid rgba(214,190,140,0.45); border-radius: 12px; cursor: pointer;
                transition: all 0.3s; font-size: 15px; font-weight: bold; text-align: center;
                white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.6);">
                ${SHORT_NAME[name] || name}
            </div>
        `).join('');
        $('#spotBtnGroup').html(btnHtml);

        // 自画图例，和按钮共用同一个 flex 容器，钉在底部
        const legendHtml = CATS.map((cat) => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: bold;
                color: ${CREAM}; text-shadow: 0 1px 2px rgba(0,0,0,.6);">
                <span style="width: 14px; height: 14px; border-radius: 3px; background: ${CAT_COLOR[cat]}; flex: none;"></span>${cat}
            </div>
        `).join('');
        $('#roseLegendGroup').html(legendHtml);

        $('.spot-btn-item').on('click', function () {
            const spotName = $(this).data('name');
            currentIndex = spotNames.indexOf(spotName);
            renderPanel(spotName);
            resetAutoPlay();
        });
    }

    // 0.5 按当前模式分发到玫瑰图或词云
    function renderPanel(spotName) {
        if (currentMode === 'word') {
            renderWordCloud(spotName);
        } else {
            renderRose(spotName);
        }
    }

    // 2. 核心渲染函数：南丁格尔玫瑰图
    function renderRose(spotName) {
        const counts = badReasonCount.bySpot[spotName] || {};
        const data = CATS.map((cat) => ({
            name: cat,
            value: counts[cat] || 0,
            itemStyle: { color: CAT_COLOR[cat] }
        }));

        const option = {
            title: {
                text: `🌺 ${spotName} · 差评原因分布`,
                textStyle: {
                    color: CREAM, fontSize: 16, fontWeight: 'bold',
                    textBorderColor: 'rgba(0,0,0,.6)', textBorderWidth: 3
                },
                top: 10, left: 14
            },
            tooltip: {
                backgroundColor: 'rgba(18,26,24,.94)',
                borderColor: '#d6be8c',
                borderWidth: 1,
                textStyle: { color: CREAM, fontSize: 13, fontWeight: 'bold' },
                formatter: (p) => `${p.name}：${p.value} 条`
            },
            // 图例已经改成自画的 DOM（跟右侧按钮同一个 flex 容器），这里不用 ECharts 自带图例了
            legend: { show: false },
            series: [{
                type: 'pie',
                roseType: 'area',
                radius: ['12%', '56%'],
                center: ['27%', '50%'],
                avoidLabelOverlap: true,
                label: {
                    show: true,
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: 'bold',
                    lineHeight: 19,
                    textBorderColor: 'rgba(0,0,0,.7)',
                    textBorderWidth: 3,
                    formatter: '{b}\n{c}条'
                },
                labelLine: { length: 14, length2: 20, lineStyle: { color: 'rgba(245,236,217,.6)', width: 1.5 } },
                itemStyle: { borderColor: 'rgba(11,15,25,.9)', borderWidth: 2 },
                emphasis: { scale: true },
                data: data
            }]
        };

        $('#roseWordCloud').hide();
        $('#roseLegendGroup').css('visibility', 'visible');
        chartLeft.getDom().querySelectorAll('canvas').forEach((c) => c.style.display = '');
        chartLeft.setOption(option, true);

        $('.spot-btn-item').css({ background: 'rgba(255,255,255,0.1)', color: '#f0ebdd', borderColor: 'rgba(214,190,140,0.45)' });
        $(`.spot-btn-item[data-name="${spotName}"]`).css({ background: '#8c1c2b', color: '#fff', borderColor: '#8c1c2b' });
    }

    // 词云排布：大词先占中心，沿黄金角螺旋一圈圈往外找不重叠的空位——半径完全由"要绕开已经放下
    // 的词"这个真实约束决定，不是预先划格子硬分配，不会出现"分配到的格子正好贴着大字"的问题。
    // 找不到就退一步扫全图挑离中心最近的空位兜底，还是不行就缩小尺寸，绝不跳过不画。
    const WC_GOLDEN_ANGLE = 2.399963;
    function placeWordsSpiral(boxes) {
        const pad = 1.3;
        const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].h - boxes[a].h);
        const placed = [];
        const positions = new Array(boxes.length);
        function overlaps(box) {
            for (let i = 0; i < placed.length; i++) {
                const p = placed[i];
                if (box.left < p.left + p.w + pad && box.left + box.w + pad > p.left &&
                    box.top < p.top + p.h + pad && box.top + box.h + pad > p.top) return true;
            }
            return false;
        }
        function findSpot(w, h, startAngle) {
            let angle = startAngle, radius = 0;
            for (let i = 0; i < 500; i++) {
                const cx = 50 + radius * Math.cos(angle);
                const cy = 50 + radius * Math.sin(angle) * 0.62;
                const box = { left: cx - w / 2, top: cy - h / 2, w, h };
                if (box.left >= 2 && box.left + w <= 98 && box.top >= 2 && box.top + h <= 96 && !overlaps(box)) {
                    return { left: cx, top: cy };
                }
                angle += 0.22;
                radius += 0.15;
            }
            let best = null, bestDist = Infinity;
            let fallback = null, fallbackOverlap = Infinity; // 真没空位也不堆正中心，会被最大的词挡住
            function totalOverlapArea(box) {
                let sum = 0;
                for (let i = 0; i < placed.length; i++) {
                    const p = placed[i];
                    const ox = Math.max(0, Math.min(box.left + box.w, p.left + p.w) - Math.max(box.left, p.left));
                    const oy = Math.max(0, Math.min(box.top + box.h, p.top + p.h) - Math.max(box.top, p.top));
                    sum += ox * oy;
                }
                return sum;
            }
            for (let gy = 1; gy <= 98 - h; gy += 2) {
                for (let gx = 1; gx <= 99 - w; gx += 2) {
                    const gbox = { left: gx, top: gy, w, h };
                    const cxg = gx + w / 2, cyg = gy + h / 2;
                    if (!overlaps(gbox)) {
                        const dist = (cxg - 50) ** 2 + (cyg - 50) ** 2;
                        if (dist < bestDist) { bestDist = dist; best = { left: cxg, top: cyg }; }
                    } else {
                        const overlapArea = totalOverlapArea(gbox);
                        if (overlapArea < fallbackOverlap) { fallbackOverlap = overlapArea; fallback = { left: cxg, top: cyg }; }
                    }
                }
            }
            return best || fallback;
        }
        order.forEach((idx, rank) => {
            const b = boxes[idx];
            let scale = 1, pos = null;
            while (!pos && scale > 0.45) {
                pos = findSpot(b.w * scale, b.h * scale, rank * WC_GOLDEN_ANGLE);
                if (!pos) scale -= 0.05;
            }
            if (!pos) { pos = findSpot(b.w * 0.45, b.h * 0.45, rank * WC_GOLDEN_ANGLE); scale = 0.45; }
            positions[idx] = pos ? { left: pos.left, top: pos.top, scale } : null;
            if (pos) placed.push({ left: pos.left - b.w * scale / 2, top: pos.top - b.h * scale / 2, w: b.w * scale, h: b.h * scale });
        });
        return positions;
    }

    // 2.5 差评关键词词云：按景点拆开的真实高频词（data/badWordsBySpot.js），跟玫瑰图共用同一套切换按钮
    function renderWordCloud(spotName) {
        // 只用 ECharts 的 title 占位，饼图本体清空，词云另外用 DOM 画在下面
        chartLeft.setOption({
            title: {
                text: `☁️ ${spotName} · 差评高频词`,
                textStyle: {
                    color: CREAM, fontSize: 16, fontWeight: 'bold',
                    textBorderColor: 'rgba(0,0,0,.6)', textBorderWidth: 3
                },
                top: 10, left: 14
            },
            tooltip: { show: false },
            legend: { show: false },
            series: []
        }, true);
        chartLeft.getDom().querySelectorAll('canvas').forEach((c) => c.style.display = 'none');

        if ($('#roseWordCloud').length === 0) {
            $('#panelTopLeft').append(`<div id="roseWordCloud" style="
                position: absolute; top: 50px; left: 14px; right: 270px; bottom: 50px;
                overflow: hidden;"></div>`);
        }

        const raw = ((typeof badWordsBySpot !== 'undefined' && badWordsBySpot[spotName]) || []).slice(0, 18);
        // 暖色系从亮橙到深酒红，按词频排名分配，不是按字号本身算颜色，层次更丰富
        const PALETTE = ['#ffb74d', '#ff9a5a', '#f2805a', '#e86a5a', '#d0544f', '#b8423f', '#a03535', '#8c2e30'];
        const words = raw.map((w, i) => ({ ...w, rank: i }));

        // 词云模式下右边那栏图例是隐藏的，词云可以往右多占一点，但要留够按钮列的位置，不能贴上去
        const $cloud = $('#roseWordCloud').show().css('right', '172px');
        const stageRect = $cloud[0].getBoundingClientRect();
        // 全站是按 rem（flexible.js：1rem = 屏宽/24，基准 80px）做自适应的，字号却一直是写死的 px，
        // 窗口变窄时面板跟着 rem 一起缩小，这坨字号却不缩，于是字比格子还大、全挤在一起——
        // 这里按当前 rem 相对基准 80px 的比例把字号也缩放一下，跟全站的缩放口径对齐
        const remScale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 80;
        // 用 canvas 实际量文字宽度，而不是"字数×字号"估算——估算宁可估大导致空隙大，量准了才能紧密排列还不重叠
        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');
        // 字号按"在本景点里排第几"算，不按词频数值本身算——宝峰湖评论少，一堆词频挨得很近
        // （比如 5 个词都是 11 次），按数值比大小会有好几个词同时卡在差不多大的字号上，
        // 堆在一起不好排；改成按排名算，不管数值挨多近，每个名次永远占一级字号，
        // 18 个词的字号分布形状在每个景点都一样，不会出现"这个景点字普遍偏大"
        const n = Math.max(words.length - 1, 1);
        const metas = words.map((w) => {
            const t = 1 - w.rank / n; // 排第一的 =1，最后一名 =0
            // 指数>1，把中后段往小了压、前几名更突出，层次感不靠词频原始数值撑
            const sizeT = Math.pow(t, 1.3);
            const fontPx = (15 + sizeT * 71) * remScale; // 15~86px 按 rem 比例缩放
            measureCtx.font = `900 ${fontPx}px sans-serif`;
            const realWidth = measureCtx.measureText(w.name).width;
            const realHeight = fontPx * 1.1;
            const wPct = (realWidth * 1.1) / stageRect.width * 100;
            const hPct = (realHeight * 1.15) / stageRect.height * 100;
            return { fontPx, wPct, hPct };
        });
        const positions = placeWordsSpiral(metas.map((m) => ({ w: m.wPct, h: m.hPct })));

        // 实在挤不下的词会被按比例缩小塞进剩下的空隙里，而不是直接消失或叠在别的字上
        const wordsHtml = words.map((w, idx) => {
            if (!positions[idx]) return '';
            const color = PALETTE[Math.min(w.rank, PALETTE.length - 1)];
            const fontPx = metas[idx].fontPx * (positions[idx].scale || 1);
            return `<span style="position:absolute; left:${positions[idx].left.toFixed(2)}%; top:${positions[idx].top.toFixed(2)}%;
                transform:translate(-50%,-50%);
                font-size:${fontPx.toFixed(1)}px; font-weight:900; color:${color}; white-space:nowrap;
                -webkit-text-stroke:0.3px ${color};">${w.name}</span>`;
        }).join('');
        $cloud.html(wordsHtml);
        $('#roseLegendGroup').css('visibility', 'hidden');

        $('.spot-btn-item').css({ background: 'rgba(255,255,255,0.1)', color: '#f0ebdd', borderColor: 'rgba(214,190,140,0.45)' });
        $(`.spot-btn-item[data-name="${spotName}"]`).css({ background: '#8c1c2b', color: '#fff', borderColor: '#8c1c2b' });
    }

    // 3. 自动轮播（手动点击会重置计时）
    function startAutoPlay() {
        autoPlayTimer = setInterval(() => {
            currentIndex = (currentIndex + 1) % spotNames.length;
            renderPanel(spotNames[currentIndex]);
        }, 5000);
    }

    function resetAutoPlay() {
        clearInterval(autoPlayTimer);
        startAutoPlay();
    }

    initController();
    initModeToggle();
    renderPanel(spotNames[0]);
    startAutoPlay();

    // 词云的字号是按渲染那一刻的面板尺寸算出的固定 px，面板大小一变（比如窗口缩放）
    // 旧字号就对不上新尺寸了，字会糊在一起——所以词云模式下 resize 要重新画一遍，
    // 不能只 chartLeft.resize()（那个只管饼图，词云模式下饼图是空的）
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        chartLeft.resize();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (currentMode === 'word') renderWordCloud(spotNames[currentIndex]);
        }, 200);
    });
});

// ==========================================================
// 右上角：气候-人气「节气盘」—— 月均温（内环色带）+ 评论量占比（外环轮廓）
// 数据：data/monthTemp.js、data/monthReview.js
// ==========================================================
$(document).ready(function () {
    if (typeof monthTemp === 'undefined' || typeof monthReview === 'undefined') {
        console.error('气候节气盘：缺少 monthTemp 或 monthReview，请检查 page3.html 是否引入了 data/monthTemp.js、data/monthReview.js');
        return;
    }

    const chartRing = echarts.init(document.getElementById('panelTopRight'));
    const months = monthTemp.month;   // 1月...12月
    const temps = months.map((_, i) => monthTemp.avg[i]);
    const share = months.map((_, i) => monthReview.share[i]);

    const GOLD = '#e8b64f';
    const CREAM = '#f5ecd9';

    // 冷(靛蓝) -> 中(亮金) -> 热(朱红) 的温度色带，比原来更饱和，隔着毛玻璃面板也能看清
    const tMin = Math.min(...temps), tMax = Math.max(...temps);
    const STOPS = [
        { r: 0, c: [22, 58, 112] },
        { r: 0.5, c: [163, 115, 24] },
        { r: 1, c: [140, 20, 34] }
    ];
    function tempColor(t) {
        const ratio = (t - tMin) / (tMax - tMin);
        const [a, b] = ratio <= 0.5 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
        const span = b.r - a.r;
        const k = span === 0 ? 0 : (ratio - a.r) / span;
        const rgb = a.c.map((v, i) => Math.round(v + (b.c[i] - v) * k));
        return `rgb(${rgb.join(',')})`;
    }
    const ringColors = temps.map(tempColor);

    const peakIdx = share.indexOf(Math.max(...share));

    chartRing.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '气候人气节气盘',
            subtext: '月均温 × 评论热度',
            textStyle: { color: GOLD, fontSize: 21, fontWeight: 'bolder', textShadowColor: 'rgba(0,0,0,.5)', textShadowBlur: 4 },
            subtextStyle: { color: 'rgba(245,236,217,.8)', fontSize: 14, fontWeight: 'bold' },
            itemGap: 6,
            top: 10,
            left: 14
        },
        polar: { center: ['50%', '54%'], radius: ['50%', '74%'] },
        angleAxis: {
            type: 'category',
            data: months,
            startAngle: 90,
            clockwise: true,
            boundaryGap: false,
            axisLine: { lineStyle: { color: 'rgba(214,190,140,.45)' } },
            axisTick: { show: false },
            splitLine: { show: true, lineStyle: { color: 'rgba(214,190,140,.25)' } },
            axisLabel: { color: CREAM, fontSize: 15, fontWeight: 'bold', margin: 10 }
        },
        radiusAxis: {
            min: 0,
            max: Math.max(...share) * 1.35,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { show: false },
            splitLine: { show: false }
        },
        tooltip: {
            backgroundColor: 'rgba(18,26,24,.94)',
            borderColor: GOLD,
            borderWidth: 1,
            textStyle: { color: CREAM, fontSize: 13, fontWeight: 'bold' },
            formatter: (p) => {
                const i = p.dataIndex;
                return `${months[i]}　均温 ${temps[i].toFixed(1)}℃　评论占比 ${share[i]}%`;
            }
        },
        series: [
            {
                // 内环：温度色带（节气盘刻度环）
                type: 'pie',
                radius: ['34%', '46%'],
                center: ['50%', '54%'],
                startAngle: 90 + 15,
                clockwise: true,
                label: { show: false },
                labelLine: { show: false },
                emphasis: { scale: true },
                data: months.map((m, i) => ({
                    name: m,
                    value: 1,
                    itemStyle: { color: ringColors[i], borderColor: 'rgba(11,15,25,.9)', borderWidth: 2 }
                }))
            },
            {
                // 外环：人气轮廓（平滑面积，山峦起伏）
                type: 'line',
                coordinateSystem: 'polar',
                data: share,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: GOLD, borderColor: '#fff8e8', borderWidth: 1 },
                lineStyle: { width: 3, color: GOLD, shadowBlur: 10, shadowColor: 'rgba(214,190,140,.55)' },
                areaStyle: {
                    color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.85, [
                        { offset: 0, color: 'rgba(120,80,20,0.05)' },
                        { offset: 1, color: 'rgba(120,80,20,0.68)' }
                    ])
                }
            }
        ],
        graphic: []
    });

    window.addEventListener('resize', () => chartRing.resize());
});

// ==========================================================
// 左下角：舆情河流图 —— 差评原因 × 月份（跨年汇总）
// 数据：data/badReasonMonth.js
// ==========================================================
$(document).ready(function () {
    if (typeof badReasonMonth === 'undefined') {
        console.error('舆情河流图：缺少 badReasonMonth，请检查 page3.html 是否引入了 data/badReasonMonth.js');
        return;
    }

    const chartRiver = echarts.init(document.getElementById('panelBottomLeft'));
    const CREAM = '#f5ecd9';
    // 和①玫瑰图共用同一套颜色，方便跨图对照同一类问题
    const CAT_COLOR = {
        '排队拥挤': '#8c1c2b',
        '价格性价比': '#b8862a',
        '服务态度': '#5b2a4a',
        '天气能见度': '#1e3f6e',
        '票务问题': '#1f5a4a',
        '额外收费': '#6b7280'
    };
    // themeRiver 内部给颜色分配跟 data 顺序对不上（实测验证过，是固定错一位），这里把传入的颜色数组顺序反着错一位补偿回来
    const cats = badReasonMonth.categories;
    const colorList = cats.map((c, i) => CAT_COLOR[cats[(i + 1) % cats.length]] || '#999');

    chartRiver.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '舆情河流 · 差评原因随月份演变',
            textStyle: { color: CREAM, fontSize: 19, fontWeight: 'bolder' },
            top: 12, left: 14
        },
        legend: {
            top: 46,
            itemGap: 20,
            textStyle: { color: CREAM, fontSize: 15, fontWeight: 'bold' },
            itemWidth: 14,
            itemHeight: 14
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(18,26,24,.94)',
            borderColor: '#d6be8c',
            borderWidth: 1,
            textStyle: { color: CREAM, fontSize: 13, fontWeight: 'bold' },
            formatter: (p) => `${p.data[0]}月　${p.data[2]}：${p.data[1]} 条`
        },
        // themeRiver 必须配连续数值轴才能算出河流宽度，用文字类目轴宽度会塌成 0。
        // 之前用日期时间轴，ECharts 自己"挑好看刻度"的算法跟月份对不齐（"两个一月"就是这么来的）。
        // 改成 1~12 的数值轴，min/max/interval 精确锁 12 个刻度，数据点和刻度永远一一对应
        singleAxis: {
            top: 90,
            bottom: 24,
            left: '6%',
            right: '6%',
            type: 'value',
            min: 1,
            max: 12,
            interval: 1,
            axisLine: { lineStyle: { color: 'rgba(214,190,140,.4)' } },
            axisTick: { show: false },
            axisLabel: {
                color: CREAM, fontSize: 15, fontWeight: 'bold',
                formatter: (v) => v + '月'
            },
            splitLine: { show: false }
        },
        series: [{
            type: 'themeRiver',
            color: colorList,
            // 河流左端的文字标签窄处会挤在一起，已经有顶部图例了，这里关掉只靠颜色区分
            label: { show: false },
            emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,.6)' } },
            data: badReasonMonth.data
        }]
    });

    // 图例当筛选按钮：点哪个类别，只把它的曲线留着，其它压成 0（保留全部类别和颜色映射不变，
    // 只是把没选中的数值清零，不会打乱 themeRiver 内部的颜色顺序）
    let currentSelected = null; // null = 全部选中
    chartRiver.on('legendselectchanged', function (params) {
        currentSelected = params.selected;
        const filtered = badReasonMonth.data.map((d) => params.selected[d[2]] ? d : [d[0], 0, d[2]]);
        chartRiver.setOption({ series: [{ data: filtered }] });
    });

    // themeRiver 这个图表类型在当前用的 ECharts 4.6.0 里原生悬停提示不工作（实测确认，不是误报），
    // 所以自己做一个：横坐标按月份轴的比例换算出月份，鼠标在河流范围内移动时，弹出这个月 6 类问题各自的条数
    const riverDom = chartRiver.getDom();
    riverDom.style.position = 'relative';
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed; display: none; pointer-events: none; z-index: 999;
        background: rgba(18,26,24,.95); border: 1px solid #d6be8c; border-radius: 4px;
        padding: 8px 12px; color: ${CREAM}; font-size: 13px; font-weight: bold; line-height: 1.6;
        white-space: nowrap;`;
    document.body.appendChild(tip);

    const riverCanvas = riverDom.querySelector('canvas');
    const riverCtx = riverCanvas.getContext('2d', { willReadFrequently: true });

    function nearestCategory(r, g, b) {
        let best = null, bestDist = Infinity;
        cats.forEach((cat) => {
            const hex = CAT_COLOR[cat];
            const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
            const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
            if (dist < bestDist) { bestDist = dist; best = cat; }
        });
        // 距离太远说明鼠标压根没在任何颜色的河流上（在背景或图例上），不认它
        return bestDist < 60 * 60 * 3 ? best : null;
    }

    riverDom.addEventListener('mousemove', (e) => {
        const r = riverDom.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const leftPx = r.width * 0.06, rightPx = r.width * 0.94;
        const topPx = 90, bottomPx = r.height - 24;
        if (py < topPx || py > bottomPx || px < leftPx || px > rightPx) { tip.style.display = 'none'; return; }

        // 鼠标压的是画布上的哪个颜色，就用这个颜色反查是哪一类问题（不看 y 轴的具体数值堆叠，直接认颜色最准）
        const scaleX = riverCanvas.width / riverCanvas.clientWidth;
        const scaleY = riverCanvas.height / riverCanvas.clientHeight;
        const pixel = riverCtx.getImageData(Math.round(px * scaleX), Math.round(py * scaleY), 1, 1).data;
        const cat = nearestCategory(pixel[0], pixel[1], pixel[2]);
        if (!cat) { tip.style.display = 'none'; return; }

        let month = Math.round(1 + (px - leftPx) / (rightPx - leftPx) * 11);
        month = Math.max(1, Math.min(12, month));
        const item = badReasonMonth.data.find((d) => d[0] === month && d[2] === cat);
        const v = item ? item[1] : 0;

        tip.innerHTML = `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CAT_COLOR[cat]};margin-right:6px;"></span>${month}月 ${cat}：${v} 条`;
        tip.style.left = (e.clientX + 16) + 'px';
        tip.style.top = (e.clientY - 10) + 'px';
        tip.style.display = 'block';
    });
    riverDom.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    window.addEventListener('resize', () => chartRiver.resize());
});

// ==========================================================
// 右下角：舆情弹幕墙 —— 真实评论原文多轨弹幕滚动
// 数据：data/commentSample.js
// ==========================================================
$(document).ready(function () {
    if (typeof commentSample === 'undefined') {
        console.error('舆情弹幕墙：缺少 commentSample，请检查 page3.html 是否引入了 data/commentSample.js');
        return;
    }

    const LANES = 4;
    const SHORT_NAME = {
        '天门山国家森林公园': '天门山',
        '张家界国家森林公园': '森林公园',
        '张家界大峡谷玻璃桥': '大峡谷玻璃桥',
        '黄龙洞': '黄龙洞',
        '宝峰湖': '宝峰湖'
    };

    function itemHtml(c) {
        const spotShort = SHORT_NAME[c.spot] || c.spot;
        return `<span class="danmu-item ${c.sentiment}">
            <span class="danmu-spot-tag">${spotShort}·${c.score}分</span>${c.text}
        </span>`;
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const $wall = $('#danmuWall');
    function renderLanes(filtered) {
        const comments = shuffle(filtered);
        const lanes = Array.from({ length: LANES }, () => []);
        comments.forEach((c, i) => lanes[i % LANES].push(c));

        $wall.empty();
        lanes.forEach((laneComments, i) => {
            if (laneComments.length === 0) return;
            const itemsHtml = laneComments.map(itemHtml).join('');
            // 轨道内容重复一遍首尾相接，配合 translateX(-50%) 做无缝循环
            const duration = 60 + i * 15; // 每条轨道速度略有不同，更有层次（放慢，字能看清）
            const direction = i % 2 === 0 ? 'normal' : 'reverse';
            const $lane = $(`<div class="danmu-lane"></div>`);
            const $track = $(`<div class="danmu-track" style="animation-duration:${duration}s; animation-direction:${direction};">${itemsHtml}${itemsHtml}</div>`);
            $lane.append($track);
            $wall.append($lane);
        });
    }

    // 景点标签：全部 + 抽样数据里实际出现过的景点，支持点击手动切换、也会自动轮播
    const spotNames = Array.from(new Set(commentSample.comments.map((c) => c.spot)));
    const spotOptions = spotNames;
    let spotIndex = 0;
    let spotAutoTimer = null;

    const $spotTabs = $('#danmuSpotTabs');
    $spotTabs.html(spotOptions.map((name) =>
        `<div class="danmu-spot-tab" data-spot="${name}">${name === 'all' ? '全部景点' : (SHORT_NAME[name] || name)}</div>`
    ).join(''));

    let currentSentiment = 'all';

    function applyFilters() {
        const spot = spotOptions[spotIndex];
        const filtered = commentSample.comments.filter((c) =>
            (currentSentiment === 'all' || c.sentiment === currentSentiment) && (spot === 'all' || c.spot === spot)
        );
        renderLanes(filtered);
        $('.danmu-spot-tab').removeClass('active');
        $(`.danmu-spot-tab[data-spot="${spot}"]`).addClass('active');
    }

    function startSpotAutoPlay() {
        spotAutoTimer = setInterval(() => {
            spotIndex = (spotIndex + 1) % spotOptions.length;
            applyFilters();
        }, 18000); // 弹幕滚动本身变慢了，切换间隔也要拉长，不然每条轨道还没滚起来就被重置了
    }
    function resetSpotAutoPlay() {
        clearInterval(spotAutoTimer);
        startSpotAutoPlay();
    }

    $spotTabs.on('click', '.danmu-spot-tab', function () {
        spotIndex = spotOptions.indexOf($(this).data('spot').toString());
        applyFilters();
        resetSpotAutoPlay();
    });
    $('.sentiment-tab').on('click', function () {
        currentSentiment = $(this).data('sentiment');
        $('.sentiment-tab').removeClass('active');
        $(this).addClass('active');
        applyFilters();
    });

    applyFilters();
    startSpotAutoPlay();

    const good = commentSample.comments.filter((c) => c.sentiment === 'pos').length;
    const bad = commentSample.comments.length - good;
    $('#danmuHeader').text(`舆情弹幕墙 · 真实游客评论（好评${good} / 差评${bad}）`);
});