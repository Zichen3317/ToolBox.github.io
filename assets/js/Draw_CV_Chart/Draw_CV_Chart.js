// ======================= 全局数据存储 =======================
let curves = [];            // 每个元素: { name, x, y, color }
// 预定义颜色池 (明亮色系)
const colorPalette = [
    '#d62728', '#2c7fb8', '#31a354', '#e377c2', '#ff7f0e',
    '#9467bd', '#8c564b', '#bcbd22', '#17becf', '#f4a261',
    '#6a4e9b', '#e9c46a', '#e76f51', '#3b8e6e', '#b5838a'
];

// 获取DOM元素
const plotDiv = document.getElementById('cvPlot');
const chartTitleInput = document.getElementById('chartTitle');
const xAxisTitleInput = document.getElementById('xAxisTitle');
const yAxisTitleInput = document.getElementById('yAxisTitle');
const curveListDiv = document.getElementById('curveListContainer');
const statusMsgDiv = document.getElementById('statusMsg');
const skipHeaderCheck = document.getElementById('skipHeaderCheckbox');

// =============== 辅助: 更新曲线列表UI ===============
function updateCurveListUI() {
    if (!curveListDiv) return;
    if (curves.length === 0) {
        curveListDiv.innerHTML = '<div style="color:#6c757d;">暂无曲线，请导入Excel或使用下方演示数据</div>';
        return;
    }
    let html = '';
    curves.forEach((curve, idx) => {
        const color = curve.color || colorPalette[idx % colorPalette.length];
        html += `
            <div class="curve-item">
                <div style="display:flex; align-items:center;">
                    <span class="curve-color" style="background:${color};"></span>
                    <span style="font-weight:500;">${escapeHtml(curve.name)}</span>
                    <span style="margin-left:8px; font-size:0.65rem; color:#4b5563;">(${curve.x.length} pts)</span>
                </div>
                <button class="remove-curve-btn" data-index="${idx}" style="background:none; border:none; color:#b91c1c; cursor:pointer; font-size:1.1rem;">✖</button>
            </div>
        `;
    });
    curveListDiv.innerHTML = html;
    // 绑定删除按钮事件
    document.querySelectorAll('.remove-curve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            if (!isNaN(idx) && idx >= 0 && idx < curves.length) {
                curves.splice(idx, 1);
                updateCurveListUI();
                renderAllCurves();
                showStatus(`已删除曲线，剩余 ${curves.length} 条曲线`, '#2c7fb8');
            }
            e.stopPropagation();
        });
    });
}

// 简单防XSS
function escapeHtml(str) { return String(str).replace(/[&<>]/g, function(m){if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

function showStatus(msg, bgColor = '#eef2ff') {
    if(statusMsgDiv) {
        statusMsgDiv.innerHTML = msg;
        statusMsgDiv.style.background = bgColor;
        setTimeout(() => {
            if(statusMsgDiv.innerHTML === msg) statusMsgDiv.style.background = '#eef2ff';
        }, 2500);
    }
}

// =============== 核心绘图函数 (支持多曲线 + 封闭轴 + 自定义标题) ===============
function renderAllCurves() {
    if (!plotDiv) return;
    // 读取用户自定义标题
    const mainTitle = chartTitleInput.value.trim() || "循环伏安图";
    const xTitle = xAxisTitleInput.value.trim() || "Potential (V)";
    const yTitle = yAxisTitleInput.value.trim() || "Current (μA)";

    // 构建 traces
    let traces = [];
    if (curves.length === 0) {
        // 没有曲线时显示一个占位空图，仍然保持坐标框
        traces.push({
            x: [],
            y: [],
            mode: 'lines',
            type: 'scatter',
            name: '无数据',
            line: { color: '#cccccc', dash: 'dot' },
            hoverinfo: 'none'
        });
    } else {
        curves.forEach((curve, idx) => {
            if (!curve.x || !curve.y || curve.x.length === 0) return;
            const lineColor = curve.color || colorPalette[idx % colorPalette.length];
            traces.push({
                x: curve.x,
                y: curve.y,
                mode: 'lines',
                type: 'scatter',
                name: curve.name,
                line: { color: lineColor, width: 2.2 },
                hovertemplate: '%{x:.3f} V<br>%{y:.2f} μA<extra>'+escapeHtml(curve.name)+'</extra>'
            });
        });
    }

    // 封闭坐标轴画框配置 (mirror: 'all', 显示四周轴线)
    const layout = {
        title: {
            text: mainTitle,
            font: { size: 18, family: 'Segoe UI, Roboto', color: '#1e4663' },
            x: 0.05,
            xanchor: 'left'
        },
        xaxis: {
            title: { text: xTitle, font: { size: 12, weight: 'bold' } },
            showline: true,
            mirror: true,          // 上下轴线封闭
            linecolor: 'black',
            linewidth: 1.2,
            tickcolor: 'black',
            ticklen: 6,
            ticks: 'outside',
            showgrid: false,
            gridcolor: '#e2e8f0',
            zeroline: false,
            showticklabels: true,
            tickfont: { size: 10 }
        },
        yaxis: {
            title: { text: yTitle, font: { size: 12, weight: 'bold' } },
            showline: true,
            mirror: true,          // 左右轴线封闭
            linecolor: 'black',
            linewidth: 1.2,
            tickcolor: 'black',
            ticklen: 6,
            ticks: 'outside',
            showgrid: false,
            gridcolor: '#e2e8f0',
            zeroline: false,
            showticklabels: true,
            tickfont: { size: 10 }
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        margin: { l: 65, r: 40, t: 80, b: 55 },
        hovermode: 'closest',
        showlegend: curves.length > 0,
        legend: { orientation: 'v', x: 1.02, xanchor: 'left', y: 1, bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#ccc', borderwidth: 0.5 },
        font: { family: 'Segoe UI, Roboto' }
    };

    // 动态范围
    if (curves.length > 0) {
        let allX = [], allY = [];
        curves.forEach(c => { allX.push(...c.x); allY.push(...c.y); });
        if (allX.length) {
            let xMin = Math.min(...allX), xMax = Math.max(...allX);
            let yMin = Math.min(...allY), yMax = Math.max(...allY);
            let xPad = (xMax - xMin) * 0.05 || 0.1;
            let yPad = (yMax - yMin) * 0.08 || 0.5;
            layout.xaxis.range = [xMin - xPad, xMax + xPad];
            layout.yaxis.range = [yMin - yPad, yMax + yPad];
        }
    } else {
        layout.xaxis.range = [-0.8, 0.9];
        layout.yaxis.range = [-180, 220];
    }

    Plotly.react(plotDiv, traces, layout, { responsive: true, displayModeBar: true });
}

// =============== 解析Excel文件，提取前两列 ===============
function parseExcelToCurve(file, skipHeader) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
            if (!rows || rows.length === 0) {
                reject(new Error("表格为空"));
                return;
            }
            let startRow = 0;
            if (skipHeader) startRow = 1;
            let potentials = [], currents = [];
            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 2) continue;
                let pot = parseFloat(row[0]);
                let cur = parseFloat(row[1]);
                if (isNaN(pot) || isNaN(cur)) continue;
                potentials.push(pot);
                currents.push(cur);
            }
            if (potentials.length < 2) {
                reject(new Error("有效数据点不足2个，请检查列或跳过首行选项"));
            } else {
                resolve({ x: potentials, y: currents });
            }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsArrayBuffer(file);
    });
}

// 添加曲线 (自动分配名称和颜色)
function addCurve(xData, yData, baseName) {
    if (!xData || !yData || xData.length === 0 || yData.length !== xData.length) {
        showStatus(`曲线 "${baseName}" 数据无效，未添加`, '#ffe6e6');
        return false;
    }
    // 防止重名太乱，若重名加序号
    let finalName = baseName;
    let nameSet = new Set(curves.map(c => c.name));
    let counter = 1;
    while (nameSet.has(finalName)) {
        finalName = `${baseName}_${counter++}`;
    }
    const newColor = colorPalette[curves.length % colorPalette.length];
    curves.push({
        name: finalName,
        x: [...xData],
        y: [...yData],
        color: newColor
    });
    updateCurveListUI();
    renderAllCurves();
    return true;
}

// 替换所有曲线为单条 (用于手动/演示)
function replaceWithSingleCurve(xData, yData, curveName) {
    if (!xData || xData.length === 0 || yData.length !== xData.length) {
        showStatus("数据无效，无法替换", '#ffe0e0');
        return false;
    }
    curves = [];
    const newColor = colorPalette[0];
    curves.push({
        name: curveName,
        x: [...xData],
        y: [...yData],
        color: newColor
    });
    updateCurveListUI();
    renderAllCurves();
    showStatus(`✅ 已替换为单曲线: ${curveName} (${xData.length}点)`, '#e0f2fe');
    return true;
}

// =============== 事件绑定与初始化 ===============
// 辅助数值解析函数
function parseNumericArray(inputStr) {
    if (!inputStr.trim()) return [];
    let cleaned = inputStr.replace(/，/g, ',').replace(/\s+/g, ',').replace(/,,+/g, ',');
    let parts = cleaned.split(',').filter(s => s.trim() !== '');
    let numbers = [];
    for (let part of parts) {
        let num = parseFloat(part.trim());
        if (!isNaN(num)) numbers.push(num);
    }
    return numbers;
}

// 生成高质量演示CV数据
function generateDemoCVData() {
    let potentials = [];
    for (let v = -0.65; v <= 0.70; v += 0.012) potentials.push(parseFloat(v.toFixed(5)));
    for (let v = 0.688; v >= -0.65; v -= 0.012) potentials.push(parseFloat(v.toFixed(5)));
    let currents = [];
    for (let i = 0; i < potentials.length; i++) {
        let E = potentials[i];
        let anodic = 168 * Math.exp(-Math.pow((E - 0.28) / 0.13, 2));
        let cathodic = -135 * Math.exp(-Math.pow((E + 0.12) / 0.14, 2));
        let bg = 8 * E + 2 * Math.sin(E * 3);
        let noise = (Math.random() - 0.5) * 1.2;
        currents.push(parseFloat((anodic + cathodic + bg + noise).toFixed(3)));
    }
    return { potentials, currents };
}

// 初始化默认演示曲线
function initDefaultDemo() {
    const { potentials, currents } = generateDemoCVData();
    curves = [];
    curves.push({
        name: "演示CV曲线 (典型氧化还原峰)",
        x: potentials,
        y: currents,
        color: colorPalette[0]
    });
    updateCurveListUI();
    renderAllCurves();
    document.getElementById('potentialInput').value = potentials.map(v=>v.toFixed(5)).join(', ');
    document.getElementById('currentInput').value = currents.map(c=>c.toFixed(3)).join(', ');
    showStatus("默认演示曲线已加载 | 支持上传多Excel对比", "#dcfce7");
}

// DOM 加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
    // 绑定各按钮事件
    const excelInput = document.getElementById('excelFiles');
    if (excelInput) {
        excelInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            const skipHeader = skipHeaderCheck.checked;
            showStatus(`⏳ 正在解析 ${files.length} 个文件，请稍候...`, '#fff3bf');
            let successCount = 0;
            for (let file of files) {
                try {
                    const { x, y } = await parseExcelToCurve(file, skipHeader);
                    let name = file.name.replace(/\.(xlsx|xls|xlsm)$/i, '');
                    if (name.length > 35) name = name.slice(0,32)+'...';
                    addCurve(x, y, name);
                    successCount++;
                } catch (err) {
                    console.warn(`解析失败 ${file.name}:`, err);
                    showStatus(`⚠️ 文件 "${file.name}" 解析失败: ${err.message}`, '#ffe0e0');
                }
            }
            if (successCount > 0) showStatus(`✨ 成功添加 ${successCount} 条曲线，当前共 ${curves.length} 条`, '#dcfce7');
            excelInput.value = ''; // 清空，允许重复上传同文件
        });
    }

    const csvAdd = document.getElementById('csvFileAdd');
    if (csvAdd) {
        csvAdd.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const content = ev.target.result;
                const lines = content.split(/\r?\n/).filter(l => l.trim());
                let pots = [], currs = [];
                for (let line of lines) {
                    let parts = line.split(/[ ,\t]+/).filter(p => p.trim() !== '');
                    if (parts.length < 2) continue;
                    let p = parseFloat(parts[0]);
                    let c = parseFloat(parts[1]);
                    if (isNaN(p) || isNaN(c)) continue;
                    pots.push(p);
                    currs.push(c);
                }
                if (pots.length > 0 && pots.length === currs.length) {
                    let name = file.name.replace(/\.(csv|txt)$/i, '');
                    addCurve(pots, currs, name);
                } else {
                    showStatus("CSV解析失败，需两列数值且点数一致", '#ffe0e0');
                }
                csvAdd.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        });
    }

    const manualBtn = document.getElementById('manualPlotBtn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            const potStr = document.getElementById('potentialInput').value;
            const curStr = document.getElementById('currentInput').value;
            let pots = parseNumericArray(potStr);
            let currs = parseNumericArray(curStr);
            if (pots.length === 0 || currs.length === 0) {
                showStatus("❌ 电势或电流输入为空，无法绘图", '#ffe0e0');
                return;
            }
            if (pots.length !== currs.length) {
                showStatus(`⚠️ 数据点数不一致: 电势${pots.length} / 电流${currs.length}`, '#ffe0e0');
                return;
            }
            replaceWithSingleCurve(pots, currs, "手动输入曲线");
        });
    }

    const demoBtn = document.getElementById('demoPlotBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            const { potentials, currents } = generateDemoCVData();
            replaceWithSingleCurve(potentials, currents, "演示CV曲线 (典型氧化还原峰)");
            document.getElementById('potentialInput').value = potentials.map(v=>v.toFixed(5)).join(', ');
            document.getElementById('currentInput').value = currents.map(c=>c.toFixed(3)).join(', ');
        });
    }

    const clearBtn = document.getElementById('clearCurvesBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (curves.length > 0 && confirm("清除所有曲线吗？")) {
                curves = [];
                updateCurveListUI();
                renderAllCurves();
                showStatus("所有曲线已清除", "#f1f5f9");
            } else if(curves.length===0) showStatus("当前无曲线可清除", "#f1f5f9");
        });
    }

    const refreshBtn = document.getElementById('refreshPlotBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => { renderAllCurves(); showStatus("已刷新图表", "#e2f0fa"); });

    const applyLabels = document.getElementById('applyLabelsBtn');
    if (applyLabels) applyLabels.addEventListener('click', () => { renderAllCurves(); showStatus("标题/轴标签已更新", "#e2f0fa"); });

    // 启动默认演示
    initDefaultDemo();
});