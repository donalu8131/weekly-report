// ======================== 状态管理 ========================
const AppState = {
  currentUser: null,
  employees: [],

  init() {
    this.loadUser();
  },

  setUser(user) {
    this.currentUser = user;
    localStorage.setItem('weekly_report_user', JSON.stringify(user));
  },

  loadUser() {
    const saved = localStorage.getItem('weekly_report_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    }
  },

  clearUser() {
    this.currentUser = null;
    localStorage.removeItem('weekly_report_user');
  }
};

// ======================== 工具函数 ========================
const Utils = {
  async api(url, options = {}) {
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    const response = await fetch(url, config);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    setTimeout(() => toast.classList.add('toast-hidden'), 3000);
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  getCurrentWeekLabel() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.toISOString().split('T')[0]} ~ ${sunday.toISOString().split('T')[0]}`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 给评分圆圈上色
  getScoreColor(score) {
    if (score >= 90) return { color: '#059669', bg: '#ECFDF5' };
    if (score >= 80) return { color: '#4F46E5', bg: '#EEF2FF' };
    if (score >= 70) return { color: '#D97706', bg: '#FFFBEB' };
    if (score >= 60) return { color: '#DC2626', bg: '#FEF2F2' };
    return { color: '#991B1B', bg: '#FEE2E2' };
  }
};

// ======================== 登录模块 ========================
const LoginModule = {
  init() {
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    // 如果是已登录用户，直接进入主页面
    if (AppState.currentUser) {
      this.enterMain(AppState.currentUser);
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const department = document.getElementById('loginDepartment').value;

    if (!name || !department) {
      Utils.showToast('请填写姓名并选择部门', 'error');
      return;
    }

    const submitBtn = document.querySelector('#loginForm .btn-primary');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
      const result = await Utils.api('/api/login', {
        method: 'POST',
        body: { name, department }
      });

      if (result.success) {
        AppState.setUser(result.employee);
        Utils.showToast(`欢迎回来，${result.employee.name}！`, 'success');
        this.enterMain(result.employee);
      }
    } catch (err) {
      Utils.showToast(err.message || '登录失败，请重试', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').style.display = 'inline';
      submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
  },

  enterMain(user) {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('mainPage').classList.add('active');
    document.getElementById('currentUserBadge').textContent = `${user.name} · ${user.department}`;
    document.getElementById('reportEmployeeId').value = user.id;
    document.getElementById('reportEmployeeName').value = user.name;
    document.getElementById('reportDepartment').value = user.department;

    // 初始化各模块
    DashboardModule.init();
    HistoryModule.init();
    AnalysisModule.init();
    StatsModule.loadStats();
  }
};

// ======================== 周报提交模块 ========================
const DashboardModule = {
  init() {
    this.setupWeekDisplay();
    this.setupDynamicLists();
    this.setupFormSubmit();
  },

  setupWeekDisplay() {
    document.getElementById('weekDisplay').textContent = Utils.getCurrentWeekLabel();
  },

  setupDynamicLists() {
    // 添加任务
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      this.addListItem('taskList', '请输入工作内容');
    });

    // 添加成果
    document.getElementById('addKeyResultBtn').addEventListener('click', () => {
      this.addListItem('keyResultList', '例如：完成XX功能上线，效率提升20%');
    });

    // 添加计划
    document.getElementById('addPlanBtn').addEventListener('click', () => {
      this.addListItem('planList', '请输入下周计划');
    });

    // 添加问题
    document.getElementById('addIssueBtn').addEventListener('click', () => {
      this.addListItem('issueList', '请描述遇到的问题');
    });

    // 现有的删除按钮
    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', function() {
        this.closest('.list-item').remove();
      });
    });
  },

  addListItem(containerId, placeholder) {
    const container = document.getElementById(containerId);
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <input type="text" class="task-input" placeholder="${placeholder}">
      <button type="button" class="btn-icon btn-remove" title="删除">×</button>
    `;
    item.querySelector('.btn-remove').addEventListener('click', function() {
      item.remove();
    });
    container.appendChild(item);
    item.querySelector('input').focus();
  },

  getListValues(containerId) {
    const container = document.getElementById(containerId);
    const inputs = container.querySelectorAll('input');
    const values = [];
    inputs.forEach(input => {
      const val = input.value.trim();
      if (val) values.push(val);
    });
    return values;
  },

  setupFormSubmit() {
    document.getElementById('reportForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const tasks = this.getListValues('taskList');
      if (tasks.length === 0) {
        Utils.showToast('请至少填写一项工作任务', 'error');
        return;
      }

      const submitBtn = document.getElementById('submitReportBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3"/></svg> 提交中...';

      try {
        const result = await Utils.api('/api/reports', {
          method: 'POST',
          body: {
            employeeId: document.getElementById('reportEmployeeId').value,
            employeeName: document.getElementById('reportEmployeeName').value,
            department: document.getElementById('reportDepartment').value,
            tasks,
            keyResults: this.getListValues('keyResultList'),
            nextWeekPlan: this.getListValues('planList'),
            issues: this.getListValues('issueList')
          }
        });

        if (result.success) {
          Utils.showToast(result.isUpdate ? '周报已更新！' : '周报提交成功！', 'success');
          StatsModule.loadStats();
        }
      } catch (err) {
        Utils.showToast(err.message || '提交失败', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> 提交周报';
      }
    });
  }
};

// ======================== 历史记录模块 ========================
const HistoryModule = {
  init() {
    this.loadHistory();
    document.getElementById('refreshHistoryBtn').addEventListener('click', () => this.loadHistory());
    document.getElementById('historyEmployeeFilter').addEventListener('change', () => this.loadHistory());
    document.getElementById('historyDeptFilter').addEventListener('change', () => this.loadHistory());
  },

  async loadHistory() {
    const listEl = document.getElementById('historyList');
    const emptyEl = document.getElementById('historyEmpty');
    const loadingEl = document.getElementById('historyLoading');

    listEl.innerHTML = '';
    emptyEl.style.display = 'none';
    loadingEl.style.display = 'block';

    try {
      let reports = await Utils.api('/api/reports');
      let employees = await Utils.api('/api/employees');

      // 填充员工筛选下拉
      const filterEl = document.getElementById('historyEmployeeFilter');
      const currentFilter = filterEl.value;
      filterEl.innerHTML = '<option value="">全部人员</option>';
      employees.forEach(emp => {
        filterEl.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.department})</option>`;
      });
      filterEl.value = currentFilter;

      // 筛选
      const empFilter = document.getElementById('historyEmployeeFilter').value;
      const deptFilter = document.getElementById('historyDeptFilter').value;

      if (empFilter) reports = reports.filter(r => r.employeeId === empFilter);
      if (deptFilter) reports = reports.filter(r => r.department === deptFilter);

      loadingEl.style.display = 'none';

      if (reports.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      reports.forEach(report => {
        const card = document.createElement('div');
        card.className = 'report-card';
        card.innerHTML = `
          <div class="report-card-main">
            <div class="report-card-week">${Utils.escapeHtml(report.weekLabel)}</div>
            <div class="report-card-meta">
              <span>👤 ${Utils.escapeHtml(report.employeeName)}</span>
              <span>🏢 ${Utils.escapeHtml(report.department)}</span>
              <span>📋 ${(report.tasks || []).length} 项任务</span>
              <span>📅 ${Utils.formatDate(report.createdAt)}</span>
            </div>
            <div class="report-card-tasks">
              ${(report.tasks || []).slice(0, 3).map(t => '• ' + Utils.escapeHtml(t)).join('<br>')}
              ${(report.tasks || []).length > 3 ? `<br>... 还有 ${report.tasks.length - 3} 项任务` : ''}
            </div>
          </div>
          <button class="btn-icon report-card-delete" data-id="${report.id}" title="删除">×</button>
        `;

        card.addEventListener('click', (e) => {
          if (!e.target.closest('.report-card-delete')) {
            ModalModule.showReportDetail(report);
          }
        });

        card.querySelector('.report-card-delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('确定要删除这篇周报吗？')) {
            try {
              await Utils.api(`/api/reports/${report.id}`, { method: 'DELETE' });
              Utils.showToast('周报已删除', 'info');
              this.loadHistory();
              StatsModule.loadStats();
            } catch (err) {
              Utils.showToast('删除失败', 'error');
            }
          }
        });

        listEl.appendChild(card);
      });
    } catch (err) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = `<p>加载失败: ${err.message}</p>`;
    }
  }
};

// ======================== 周报详情弹窗 ========================
const ModalModule = {
  init() {
    document.getElementById('modalCloseBtn').addEventListener('click', () => this.close());
    document.querySelector('.modal-backdrop').addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  showReportDetail(report) {
    const modal = document.getElementById('reportModal');
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = `周报详情 - ${report.weekLabel}`;

    let html = `
      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--gray-400);">👤 ${Utils.escapeHtml(report.employeeName)}</span>
        <span style="font-size:13px;color:var(--gray-400);">🏢 ${Utils.escapeHtml(report.department)}</span>
        <span style="font-size:13px;color:var(--gray-400);">📅 ${Utils.formatDate(report.createdAt)}</span>
      </div>
    `;

    html += '<h4>本周工作任务</h4><ul>';
    (report.tasks || []).forEach(t => {
      html += `<li>${Utils.escapeHtml(t)}</li>`;
    });
    html += '</ul>';

    if (report.keyResults && report.keyResults.length > 0) {
      html += '<h4>关键成果</h4><ul>';
      report.keyResults.forEach(k => {
        html += `<li>${Utils.escapeHtml(k)}</li>`;
      });
      html += '</ul>';
    }

    if (report.nextWeekPlan && report.nextWeekPlan.length > 0) {
      html += '<h4>下周计划</h4><ul>';
      report.nextWeekPlan.forEach(p => {
        html += `<li>${Utils.escapeHtml(p)}</li>`;
      });
      html += '</ul>';
    }

    if (report.issues && report.issues.length > 0) {
      html += '<h4>遇到的问题</h4><ul>';
      report.issues.forEach(i => {
        html += `<li>${Utils.escapeHtml(i)}</li>`;
      });
      html += '</ul>';
    }

    body.innerHTML = html;
    modal.classList.remove('modal-hidden');
  },

  close() {
    document.getElementById('reportModal').classList.add('modal-hidden');
  }
};

// ======================== AI 分析模块 ========================
const AnalysisModule = {
  init() {
    // 分析范围切换
    document.querySelectorAll('input[name="analysisScope"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.getElementById('teamDeptRow').style.display =
          radio.value === 'team' ? 'block' : 'none';
      });
    });

    document.getElementById('runAnalysisBtn').addEventListener('click', () => this.runAnalysis());
    document.getElementById('exportAnalysisBtn').addEventListener('click', () => this.exportReport());
  },

  async runAnalysis() {
    const btn = document.getElementById('runAnalysisBtn');
    const resultDiv = document.getElementById('analysisResult');
    const scope = document.querySelector('input[name="analysisScope"]:checked').value;

    btn.disabled = true;
    btn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3"/></svg> 分析中...';
    resultDiv.style.display = 'none';

    try {
      let data;
      if (scope === 'self') {
        data = await Utils.api(`/api/analysis/${AppState.currentUser.id}`);
      } else {
        const dept = document.getElementById('analysisDept').value;
        data = await Utils.api(`/api/analysis/team/${encodeURIComponent(dept)}`);
      }

      if (scope === 'self') {
        this.renderPersonalAnalysis(data);
      } else {
        this.renderTeamAnalysis(data);
      }

      resultDiv.style.display = 'block';
      Utils.showToast('分析完成！', 'success');
    } catch (err) {
      Utils.showToast(err.message || '分析失败', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> 开始分析';
    }
  },

  renderPersonalAnalysis(data) {
    // 评分
    const scoreColor = Utils.getScoreColor(data.overallScore);
    const circle = document.getElementById('scoreCircle');
    circle.style.background = `conic-gradient(${scoreColor.color} ${data.overallScore * 3.6}deg, ${scoreColor.bg} 0deg)`;

    document.getElementById('scoreNumber').textContent = data.overallScore;
    document.getElementById('scoreLevel').textContent = `等级 ${data.performanceLevel}`;
    document.getElementById('scoreLevel').style.color = scoreColor.color;
    document.getElementById('scoreReportCount').textContent = data.reportCount;
    document.getElementById('scoreDateRange').textContent = data.dateRange;

    document.getElementById('detailTasks').textContent = data.summary.totalTasks;
    document.getElementById('detailCompletion').textContent = data.summary.completionRate;
    document.getElementById('detailWeeks').textContent = data.summary.weeksActive;

    // 评语
    document.getElementById('analysisComment').textContent = data.detailedComment;

    // 优势
    const strengthsEl = document.getElementById('strengthsList');
    strengthsEl.innerHTML = (data.summary.strengths || []).map(s =>
      `<span class="tag tag-strength">${Utils.escapeHtml(s)}</span>`
    ).join('') || '<span style="color:var(--gray-400);font-size:13px;">暂无数据</span>';

    // 改进
    const improvementsEl = document.getElementById('improvementsList');
    improvementsEl.innerHTML = (data.summary.improvements || []).map(i =>
      `<span class="tag tag-improvement">${Utils.escapeHtml(i)}</span>`
    ).join('') || '<span style="color:var(--gray-400);font-size:13px;">暂无数据</span>';

    // 建议
    const suggestionsEl = document.getElementById('suggestionsList');
    suggestionsEl.innerHTML = (data.suggestions || []).map(s =>
      `<li>${Utils.escapeHtml(s)}</li>`
    ).join('');

    // 任务类型分布
    this.renderTaskDistribution(data.taskTypeDistribution);

    // 趋势
    this.renderTrendChart(data.trendData);

    // 每周详情
    this.renderWeeklySummaries(data.weeklySummaries);
  },

  renderTeamAnalysis(data) {
    // 团队分析用不同的视图
    const scoreColor = Utils.getScoreColor(data.departmentStats.averageScore);
    const circle = document.getElementById('scoreCircle');
    circle.style.background = `conic-gradient(${scoreColor.color} ${data.departmentStats.averageScore * 3.6}deg, ${scoreColor.bg} 0deg)`;

    document.getElementById('scoreNumber').textContent = data.departmentStats.averageScore;
    document.getElementById('scoreLevel').textContent = `部门 ${data.department}`;
    document.getElementById('scoreLevel').style.color = scoreColor.color;
    document.getElementById('scoreReportCount').textContent = data.totalReports;
    document.getElementById('scoreDateRange').textContent = `${data.members.length} 位成员`;

    document.getElementById('detailTasks').textContent = data.departmentStats.memberCount;
    document.getElementById('detailCompletion').textContent = `S:${data.departmentStats.levelDistribution.S}`;
    document.getElementById('detailWeeks').textContent = `最高 ${data.departmentStats.maxScore}分`;

    // 评语
    const topPerformer = data.members[0];
    document.getElementById('analysisComment').textContent =
      `部门整体表现${data.departmentStats.averageScore >= 80 ? '优秀' : '良好'}。` +
      `最高分 ${topPerformer?.employeeName || '-'} (${topPerformer?.score || '-'}分)，` +
      `团队平均 ${data.departmentStats.averageScore} 分。` +
      `建议部门内分享优秀实践，针对性提升薄弱环节。`;

    // 优势-成员排名
    const strengthsEl = document.getElementById('strengthsList');
    strengthsEl.innerHTML = data.members.slice(0, 5).map((m, i) =>
      `<span class="tag tag-strength">#${i+1} ${Utils.escapeHtml(m.employeeName)} ${m.score}分 (${m.level})</span>`
    ).join('');

    // 改进
    const improvementsEl = document.getElementById('improvementsList');
    improvementsEl.innerHTML = [
      `S级: ${data.departmentStats.levelDistribution.S}人`,
      `A级: ${data.departmentStats.levelDistribution.A}人`,
      `B级: ${data.departmentStats.levelDistribution.B + data.departmentStats.levelDistribution['B+']}人`,
      `C级: ${data.departmentStats.levelDistribution.C}人`
    ].map(i => `<span class="tag tag-improvement">${i}</span>`).join('');

    // 建议
    const suggestionsEl = document.getElementById('suggestionsList');
    suggestionsEl.innerHTML = [
      `团队平均绩效 ${data.departmentStats.averageScore} 分，${data.departmentStats.averageScore >= 80 ? '整体表现良好' : '有提升空间'}`,
      `${data.totalReports} 份周报，人均 ${(data.totalReports / (data.members.length || 1)).toFixed(1)} 份`,
      `建议关注低分成员，安排导师指导`,
      `定期组织团队分享会，促进经验交流`
    ].map(s => `<li>${s}</li>`).join('');

    // 隐藏不适用于团队的图表
    document.getElementById('taskTypeDistribution').innerHTML = '<p style="color:var(--gray-400);font-size:14px;">团队分布数据请查看成员详情</p>';
    document.getElementById('trendChart').innerHTML = '<p style="color:var(--gray-400);font-size:14px;">趋势数据请查看个人分析</p>';
    document.getElementById('weeklySummaries').innerHTML = '<p style="color:var(--gray-400);font-size:14px;">每周详情请查看个人分析</p>';
  },

  renderTaskDistribution(distribution) {
    const container = document.getElementById('taskTypeDistribution');
    if (!distribution || Object.keys(distribution).length === 0) {
      container.innerHTML = '<p style="color:var(--gray-400);font-size:14px;">暂无任务分布数据</p>';
      return;
    }

    const colors = ['blue', 'green', 'orange', 'purple', 'teal', 'pink'];
    const maxVal = Math.max(...Object.values(distribution));
    let html = '';

    Object.entries(distribution).forEach(([label, count], i) => {
      const pct = maxVal > 0 ? (count / maxVal) * 100 : 0;
      html += `
        <div class="bar-item">
          <span class="bar-label">${Utils.escapeHtml(label)}</span>
          <div class="bar-track">
            <div class="bar-fill ${colors[i % colors.length]}" style="width:${pct}%">
              ${pct > 20 ? count : ''}
            </div>
          </div>
          <span style="font-size:13px;color:var(--gray-500);min-width:24px;text-align:right;">${count}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderTrendChart(trendData) {
    const container = document.getElementById('trendChart');
    if (!trendData || trendData.length === 0) {
      container.innerHTML = '<p style="color:var(--gray-400);font-size:14px;">暂无趋势数据</p>';
      return;
    }

    const maxTasks = Math.max(...trendData.map(t => t.taskCount), 1);
    let html = '';

    trendData.forEach(item => {
      const pct = (item.taskCount / maxTasks) * 100;
      let levelClass = 'medium';
      if (pct >= 70) levelClass = 'high';
      else if (pct <= 30) levelClass = 'low';

      html += `
        <div class="trend-row">
          <span class="trend-week">${Utils.escapeHtml(item.week)}</span>
          <div class="trend-bar">
            <div class="trend-fill ${levelClass}" style="width:${pct}%"></div>
          </div>
          <span class="trend-count">${item.taskCount}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderWeeklySummaries(summaries) {
    const container = document.getElementById('weeklySummaries');
    if (!summaries || summaries.length === 0) {
      container.innerHTML = '<p style="color:var(--gray-400);font-size:14px;">暂无每周详情</p>';
      return;
    }

    let html = '';
    summaries.forEach(item => {
      html += `
        <div class="weekly-item">
          <h4>${Utils.escapeHtml(item.week)}</h4>
          ${(item.tasks || []).length > 0 ? '<ul>' + item.tasks.map(t => `<li>${Utils.escapeHtml(t)}</li>`).join('') + '</ul>' : '<p style="color:var(--gray-400);font-size:13px;">无任务记录</p>'}
        </div>
      `;
    });

    container.innerHTML = html;
  },

  exportReport() {
    const resultDiv = document.getElementById('analysisResult');
    if (resultDiv.style.display === 'none') {
      Utils.showToast('请先进行分析', 'error');
      return;
    }

    const score = document.getElementById('scoreNumber').textContent;
    const level = document.getElementById('scoreLevel').textContent;
    const reportCount = document.getElementById('scoreReportCount').textContent;
    const comment = document.getElementById('analysisComment').textContent;

    const content = `周报绩效分析报告
====================
分析日期：${new Date().toLocaleString('zh-CN')}
姓名：${AppState.currentUser?.name || '-'}
部门：${AppState.currentUser?.department || '-'}

综合评分：${score}
绩效等级：${level}
分析报告数：${reportCount}

综合评语：
${comment}

优势领域：
${Array.from(document.querySelectorAll('#strengthsList .tag')).map(t => '  - ' + t.textContent).join('\n')}

改进方向：
${Array.from(document.querySelectorAll('#improvementsList .tag')).map(t => '  - ' + t.textContent).join('\n')}

发展建议：
${Array.from(document.querySelectorAll('#suggestionsList li')).map(l => '  - ' + l.textContent).join('\n')}
`;

    // 下载文本文件
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `绩效分析报告_${AppState.currentUser?.name || 'unknown'}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    Utils.showToast('分析报告已导出', 'success');
  }
};

// ======================== 统计模块 ========================
const StatsModule = {
  async loadStats() {
    try {
      const stats = await Utils.api('/api/stats/overview');
      if (stats) {
        document.getElementById('totalReportsDisplay').textContent = stats.totalReports;
        document.getElementById('submissionRateDisplay').textContent = `${stats.submissionRate}%`;
      }
    } catch (err) {
      // 静默失败
    }
  }
};

// ======================== 导航切换 ========================
const NavigationModule = {
  init() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // 切换 tab 样式
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // 切换内容
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // 刷新数据
        if (tabName === 'history') {
          HistoryModule.loadHistory();
        }
      });
    });

    // 登出
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('确定要退出登录吗？')) {
        AppState.clearUser();
        document.getElementById('mainPage').classList.remove('active');
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('loginName').value = '';
        Utils.showToast('已退出登录', 'info');
      }
    });
  }
};

// ======================== 启动应用 ========================
document.addEventListener('DOMContentLoaded', () => {
  AppState.init();
  ModalModule.init();
  NavigationModule.init();
  LoginModule.init();
});
