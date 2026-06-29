document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csv-file');
    const statusBar = document.getElementById('status-bar');
    const dashboardLists = document.getElementById('dashboard-lists');
    const downloadBtn = document.getElementById('download-capture');
    
    const warningContainer = document.getElementById('warning-container');
    const grayContainer = document.getElementById('gray-container');
    const warningBadge = document.getElementById('warning-badge');
    const grayBadge = document.getElementById('gray-badge');

    const BASE_DAILY_INCREMENT = 3000000; 
    const GRAY_BUFFER_MAX = 1000000;

    // Cache internal data untuk diproses oleh engine pembuat gambar tabel
    let globalWarningList = [];
    let globalGrayList = [];
    let globalUserGrayCounts = {};

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            statusBar.textContent = `Processing file: ${file.name}...`;
            statusBar.classList.remove('hidden');
            
            Papa.parse(file, {
                skipEmptyLines: 'greedy',
                complete: function(results) {
                    processMetrics(results.data);
                }
            });
        }
    });

    // ENGINE BARU: Membuat tabel audit murni bergaya Spreadsheet (Google Sheets) & mengonversinya menjadi gambar
    downloadBtn.addEventListener('click', () => {
        statusBar.textContent = "Generating high-fidelity spreadsheet image...";

        // 1. Buat kontainer hantu (Hidden Buffer Box) berukuran statis agar kebal responsive layout
        const bufferContainer = document.createElement('div');
        bufferContainer.style.position = 'absolute';
        bufferContainer.style.left = '-9999px';
        bufferContainer.style.top = '-9999px';
        bufferContainer.style.width = '1000px'; // Lebar spreadsheet tetap yang aman dan rapi
        bufferContainer.style.backgroundColor = '#ffffff';
        bufferContainer.style.padding = '24px';
        bufferContainer.style.boxSizing = 'border-box';
        bufferContainer.style.fontFamily = 'Arial, sans-serif';

        // 2. Judul Laporan di atas Spreadsheet
        let tableHeaderHTML = `
            <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
                <h2 style="margin: 0; font-size: 20px; color: #1f2937; font-weight: bold;">Eclairs Origin Warn List</h2>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; font-family: monospace;">Exported on: ${new Date().toLocaleString()}</p>
            </div>
        `;

        // 3. Gabungkan seluruh data menjadi satu daftar baris urut
        const spreadsheetRows = [];
        
        globalWarningList.forEach(user => {
            spreadsheetRows.push({
                ...user,
                type: 'Warn',
                grayCount: globalUserGrayCounts[user.id] || 0
            });
        });

        globalGrayList.forEach(user => {
            if (!globalWarningList.some(w => w.id === user.id)) {
                spreadsheetRows.push({
                    ...user,
                    type: 'Gray',
                    grayCount: 0,
                    grayDays: user.triggers // Untuk baris Gray murni, pemicunya adalah hari Gray-nya
                });
            }
        });

        // 4. Bangun struktur tabel murni Google Sheets lengkap dengan Gridlines baku (#cbd5e1)
        let spreadsheetTableHTML = `
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; table-layout: fixed; font-size: 13px; color: #374151;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="width: 5%; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: bold; text-align: center; color: #475569;">#</th>
                        <th style="width: 25%; border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #475569;">Trainer Name</th>
                        <th style="width: 18%; border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #475569;">UID</th>
                        <th style="width: 12%; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: bold; text-align: center; color: #475569;">Status</th>
                        <th style="width: 10%; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: bold; text-align: center; color: #475569;">Count</th>
                        <th style="width: 30%; border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #475569;">Triggered Days</th>
                    </tr>
                </thead>
                <tbody>
                    ${spreadsheetRows.length === 0 ? `
                        <tr>
                            <td colspan="6" style="border: 1px solid #cbd5e1; padding: 24px; text-align: center; color: #9ca3af; font-style: italic;">
                                No data records found to display.
                            </td>
                        </tr>
                    ` : spreadsheetRows.map((user, index) => {
                        const isWarning = user.type === 'Warn';
                        const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb'; 
                        
                        const primaryColor = isWarning ? '#dc2626' : '#4b5563'; 
                        const textTextColor = isWarning ? '#b91c1c' : '#4b5563';

                        // Format Teks Indikator Bonus (+1) beserta infomasi harinya
                        let bonusTextHTML = '';
                        let grayDaysInfoHTML = '';
                        
                        if (isWarning && user.grayCount >= 3) {
                            const bonusAmount = Math.floor(user.grayCount / 3);
                            bonusTextHTML = ` <span style="color: #d97706; font-weight: bold; font-size: 11px;">(+${bonusAmount})</span>`;
                        }

                         // Ambil list hari gray khusus untuk user warn tersebut jika ada
                        if (user.grayDays && user.grayDays.length > 0) {
                            const grayAmount = user.grayCount;
                            if(isWarning){
                                bonusTextHTML += ` <span style="color: #4b5563; font-weight: bold; font-size: 11px;">(x${grayAmount})</span>`;
                                grayDaysInfoHTML = ` <span style="color: #4b5563; font-weight: 600; font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">(${user.grayDays.join(', ')})</span>`;
                            }
                        }

                        // Gabungkan pemicu utama dengan keterangan pemicu gray tambahan di kolom Triggered Days
                        let tagsHTML = '';
                        if (user.triggers.length === 0) {
                            tagsHTML = user.grayDays && user.grayDays.length > 0
                                ? `<span style="font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">${grayDaysInfoHTML.trim()}</span>`
                                : '<span style="color:#9ca3af; font-style:italic; font-size:11px;">None</span>';
                        } else {
                            tagsHTML = `<span style="color: ${textTextColor}; font-weight: 600; font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">${user.triggers.join(', ')}</span>${grayDaysInfoHTML}`;
                        }

                        return `
                            <tr style="background-color: ${rowBgColor};">
                                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #6b7280; font-family: monospace;">${index + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: bold; color: #111827;">${escapeHtml(user.name)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-family: monospace; color: #4b5563;">${user.id}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${primaryColor}; font-size: 12px; letter-spacing: 0.5px;">
                                    ${user.type.toUpperCase()}
                                </td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${primaryColor}; font-family: monospace; font-size: 13px;">
                                    ${user.triggers.length}x${bonusTextHTML}
                                </td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; white-space: normal; word-break: break-word;">
                                    ${tagsHTML}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        bufferContainer.innerHTML = tableHeaderHTML + spreadsheetTableHTML;
        document.body.appendChild(bufferContainer);

        // 5. Potret tabel murni bebas layout eksternal
        html2canvas(bufferContainer, {
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            ignoreElements: (element) => {
                if ((element.tagName.toLowerCase() === 'style' || element.tagName.toLowerCase() === 'link') && 
                    !bufferContainer.contains(element)) {
                    return true; 
                }
                return false;
            }
        }).then(canvas => {
            const imageURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Eclairs_Origin_Warnlist_${new Date().toISOString().split('T')[0]}.png`;
            link.href = imageURL;
            link.click();
            
            document.body.removeChild(bufferContainer);
            statusBar.textContent = "Spreadsheet image download complete!";
        }).catch(err => {
            console.error("Canvas capture error:", err);
            if (document.body.contains(bufferContainer)) {
                document.body.removeChild(bufferContainer);
            }
            statusBar.textContent = "Error generating spreadsheet image asset.";
        });
    });

    function processMetrics(data) {
        if (data.length < 2) return;

        const headers = data[0].map(h => h.trim());
        const rows = data.slice(1);

        globalWarningList = [];
        globalGrayList = [];
        globalUserGrayCounts = {};

        rows.forEach(row => {
            if (row.length < 2) return;
            const trainerId = row[0]?.trim();
            const trainerName = row[1]?.trim();
            if (!trainerId || !trainerName) return;
            
            let entryDayNum = null;

            for (let idx = 2; idx < row.length; idx++) {
                const rawValStr = row[idx]?.trim();
                if (rawValStr !== undefined && rawValStr !== '') {
                    entryDayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);
                    break;
                }
            }

            if (entryDayNum === null) return;

            const warningsForUser = [];
            const graysForUser = [];

            for (let idx = 2; idx < headers.length; idx++) {
                const dayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);
                
                if (dayNum % 2 !== 0) continue;
                if (idx >= row.length) break;

                const rawValStr = row[idx]?.trim();
                
                if (rawValStr === '' && dayNum > entryDayNum) break;
                if (rawValStr === '') continue;

                const score = parseInt(rawValStr, 10);
                if (isNaN(score)) continue;

                const personalElapsedDays = (dayNum - entryDayNum) + 1;
                let targetThreshold = personalElapsedDays * BASE_DAILY_INCREMENT;

                if (dayNum === entryDayNum) {
                    targetThreshold = 3000000;
                }

                if (score < targetThreshold) {
                    const deficit = targetThreshold - score;
                    
                    if (deficit <= GRAY_BUFFER_MAX) {
                        graysForUser.push(`Day ${dayNum}`);
                    } else {
                        warningsForUser.push(`Day ${dayNum}`);
                    }
                }
            }

            globalUserGrayCounts[trainerId] = graysForUser.length;

            // --- HITUNG WEIGHT SCORE DI SINI ---
            const warnCount = warningsForUser.length;
            const grayCount = graysForUser.length;
            const calculatedWeight = ((warnCount * 3) * 1.1) + (grayCount * 1);

            if (warningsForUser.length > 0) {
                globalWarningList.push({ 
                    name: trainerName, 
                    id: trainerId, 
                    triggers: warningsForUser,
                    grayDays: graysForUser,
                    weightScore: calculatedWeight 
                });
            }
            if (graysForUser.length > 0) {
                globalGrayList.push({ 
                    name: trainerName, 
                    id: trainerId, 
                    triggers: graysForUser,
                    weightScore: calculatedWeight 
                });
            }
            
            if (warningsForUser.length === 0 && graysForUser.length >= 3) {
                globalWarningList.push({ 
                    name: trainerName, 
                    id: trainerId, 
                    triggers: [],
                    grayDays: graysForUser,
                    weightScore: calculatedWeight 
                });
            }
        });

        globalWarningList.sort((a, b) => b.weightScore - a.weightScore);
        globalGrayList.sort((a, b) => b.weightScore - a.weightScore);
        renderDashboard(globalWarningList, globalGrayList, globalUserGrayCounts);
    }

    function renderDashboard(warnings, grays, userGrayCounts) {
        warningContainer.innerHTML = '';
        grayContainer.innerHTML = '';

        warningBadge.textContent = `${warnings.length} Users`;
        grayBadge.textContent = `${grays.length} Users`;

        if (warnings.length === 0) {
            warningContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">Belum ada Daftar Warn.</p>`;
        } else {
            warnings.forEach(user => {
                const grayCount = userGrayCounts[user.id] || 0;
                warningContainer.appendChild(createRowElement(user, 'rose', grayCount));
            });
        }

        if (grays.length === 0) {
            grayContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">Belum Ada Daftar Gray.</p>`;
        } else {
            grays.forEach(user => {
                grayContainer.appendChild(createRowElement(user, 'slate', 0));
            });
        }

        statusBar.textContent = "Data processing complete.";
        dashboardLists.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
    }

    // Tampilan Interaktif di Monitor/HP (Menggunakan Tailwind agar responsive & fluid saat dibaca langsung)
    function createRowElement(user, color, grayCount) {
        const div = document.createElement('div');
        div.className = 'py-3.5 px-2 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0';
        
        const totalViolationsCount = user.triggers.length;
        const badgeBg = color === 'rose' ? 'bg-rose-600' : 'bg-slate-500';
        
        let bonusBadge = '';
            console.log(user)
        if (color === 'rose' && grayCount >= 3) {
            console.log("MEMEK")
            const bonusAmount = Math.floor(grayCount / 3);
            bonusBadge = `<span class="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold ml-1 flex items-center justify-center h-4.5 min-w-6 text-center select-none">+${bonusAmount}</span>`;
        }

        const tagsHTML = user.triggers.map(day => {
            return `<span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                color === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
            }">${day}</span>`;
        }).join(' ');

        div.innerHTML = `
            <div class="flex items-center gap-2">
                <div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <h4 class="font-bold text-sm text-slate-800 leading-none">${escapeHtml(user.name)}</h4>
                        <div class="flex items-center select-none">
                            <span class="text-[10px] ${badgeBg} text-white px-1.5 py-0.5 rounded-full font-bold flex items-center justify-center h-4.5 min-w-6 text-center select-none">${totalViolationsCount}x</span>
                            ${bonusBadge}
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 font-mono mt-1 leading-none">UID: ${user.id}</p>
                </div>
            </div>
            <div class="flex flex-wrap gap-1.5 items-center max-w-xs justify-end">
                ${tagsHTML}
            </div>
        `;
        return div;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});