#!/usr/bin/env python3
"""
周报管理系统 - 后端服务器 (Python 标准库实现)
运行: python3 server.py
"""

import http.server
import json
import os
import uuid
import mimetypes
import urllib.parse
from datetime import datetime, date

# ======================== 配置 ========================
PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DATA_DIR = os.path.join(BASE_DIR, 'data')
REPORTS_DIR = os.path.join(DATA_DIR, 'reports')
ANALYSIS_DIR = os.path.join(DATA_DIR, 'analysis')
EMPLOYEES_FILE = os.path.join(DATA_DIR, 'employees.json')

# 确保目录存在
for d in [DATA_DIR, REPORTS_DIR, ANALYSIS_DIR]:
    os.makedirs(d, exist_ok=True)

# 确保员工文件存在
if not os.path.exists(EMPLOYEES_FILE):
    with open(EMPLOYEES_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)


# ======================== 工具函数 ========================

def read_json(filepath, default=None):
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return default if default is not None else ([] if filepath.endswith('.json') else None)


def write_json(filepath, data):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_employees():
    return read_json(EMPLOYEES_FILE, [])


def get_all_reports():
    reports = []
    if os.path.exists(REPORTS_DIR):
        for fname in os.listdir(REPORTS_DIR):
            if fname.endswith('.json'):
                try:
                    with open(os.path.join(REPORTS_DIR, fname), 'r', encoding='utf-8') as f:
                        reports.append(json.load(f))
                except Exception:
                    pass
    reports.sort(key=lambda r: r.get('createdAt', ''), reverse=True)
    return reports


def get_week_range():
    """获取当前周的周一和周日"""
    today = date.today()
    monday = today
    while monday.weekday() != 0:  # 0 = Monday
        from datetime import timedelta
        monday -= timedelta(days=1)
    sunday = monday
    from datetime import timedelta
    sunday += timedelta(days=6)
    return {
        'weekStart': monday.isoformat(),
        'weekEnd': sunday.isoformat(),
        'weekLabel': f"{monday.isoformat()} ~ {sunday.isoformat()}"
    }


# ======================== AI 分析引擎 ========================

def generate_performance_analysis(reports, employee_info):
    if not reports:
        return {'error': '暂无周报数据，无法进行分析'}

    all_tasks = []
    all_key_results = []
    all_issues = []
    total_completed = 0
    total_tasks = 0

    for r in reports:
        tasks = r.get('tasks', [])
        for t in tasks:
            all_tasks.append(t)
            total_tasks += 1
            for kw in ['完成', '已完', 'done', 'closed', '上线', '交付']:
                if kw in t:
                    total_completed += 1
                    break

        krs = r.get('keyResults', [])
        if krs:
            all_key_results.extend(krs if isinstance(krs, list) else [krs])

        issues = r.get('issues', [])
        if issues:
            all_issues.extend(issues if isinstance(issues, list) else [issues])

    completion_rate = round((total_completed / total_tasks * 100)) if total_tasks > 0 else 0

    # 关键词分析
    keyword_categories = {
        'technical': ['开发', '编码', '代码', '部署', '上线', '优化', '重构', '测试', '调试', 'bug', '修复', '架构', '数据库', 'API', '接口', '前端', '后端'],
        'management': ['协调', '沟通', '会议', '评审', '计划', '安排', '组织', '推动', '跟进', '汇报', '培训'],
        'business': ['需求', '方案', '设计', '文档', '分析', '调研', '产品', '客户', '用户', '运营', '数据'],
        'innovation': ['创新', '改进', '优化', '自动化', '效率', '新方案', '新功能', '升级', '迭代']
    }

    keyword_stats = {}
    task_text = ' '.join(all_tasks).lower()
    for category, keywords in keyword_categories.items():
        count = sum(task_text.count(kw.lower()) for kw in keywords)
        keyword_stats[category] = count

    # 趋势
    trend_data = []
    for i, r in enumerate(reversed(reports)):
        trend_data.append({
            'week': r.get('weekLabel', f'第{len(reports) - i}周'),
            'taskCount': len(r.get('tasks', [])),
            'hasKeyResults': bool(r.get('keyResults')),
            'issuesCount': len(r.get('issues', []))
        })

    # 评分
    kr_quality = sum(1 for k in all_key_results if len(str(k).strip()) > 5)
    total_score = min(completion_rate / 20, 5) + \
                  min(len(reports) * 1.5, 5) + \
                  min(keyword_stats.get('innovation', 0) * 2, 5) + \
                  min(kr_quality * 2, 5) + \
                  min(keyword_stats.get('management', 0) * 1.5, 5)

    max_score = 25
    final_score = min(round((total_score / max_score) * 100), 100)

    if final_score >= 90:
        perf_level = 'S'
        comment = '表现卓越，持续产出高质量成果，在团队中起到标杆作用。建议进一步承担更高难度的挑战，拓展影响力。'
    elif final_score >= 80:
        perf_level = 'A'
        comment = '表现优秀，工作完成度高，主动性强。继续保持当前状态，可在创新和效率提升方面进一步突破。'
    elif final_score >= 70:
        perf_level = 'B+'
        comment = '表现良好，能够按时完成工作任务。建议在任务规划和成果量化方面加强，提升工作展示度。'
    elif final_score >= 60:
        perf_level = 'B'
        comment = '表现合格，基本完成工作安排。建议加强工作主动性和任务规划能力，注意提升工作质量。'
    else:
        perf_level = 'C'
        comment = '需要改进，部分任务未达到预期。建议与管理层沟通目标对齐，制定明确的改进计划。'

    # 优势与改进
    strengths = []
    if keyword_stats.get('technical', 0) > 3:
        strengths.append('技术能力')
    if keyword_stats.get('management', 0) > 2:
        strengths.append('管理协调')
    if keyword_stats.get('business', 0) > 2:
        strengths.append('业务理解')
    if keyword_stats.get('innovation', 0) > 1:
        strengths.append('创新思维')
    if completion_rate > 80:
        strengths.append('执行力')
    if len(reports) >= 3:
        strengths.append('工作持续性')

    improvements = []
    if keyword_stats.get('innovation', 0) == 0:
        improvements.append('创新与改进')
    if completion_rate < 70:
        improvements.append('任务完成率')
    if len(reports) < 2:
        improvements.append('周报规范填写')
    if kr_quality == 0:
        improvements.append('关键成果梳理')
    if len(all_issues) == 0:
        improvements.append('问题反馈与记录')

    return {
        'employeeId': employee_info.get('id', ''),
        'employeeName': employee_info.get('name', '未知'),
        'department': employee_info.get('department', ''),
        'analysisDate': datetime.now().isoformat(),
        'reportCount': len(reports),
        'dateRange': f"{reports[-1].get('weekLabel')} ~ {reports[0].get('weekLabel')}" if len(reports) >= 2
                     else reports[0].get('weekLabel', '无数据'),
        'overallScore': final_score,
        'performanceLevel': perf_level,
        'summary': {
            'totalTasks': total_tasks,
            'totalCompleted': total_completed,
            'completionRate': f'{completion_rate}%',
            'totalReports': len(reports),
            'weeksActive': len(reports),
            'strengths': strengths[:4],
            'improvements': improvements[:3]
        },
        'keywordAnalysis': keyword_stats,
        'trendData': trend_data,
        'detailedComment': comment,
        'suggestions': [
            f"优势领域：{'、'.join(strengths)}" if strengths else '建议发掘和明确个人优势领域',
            f"改进方向：{'、'.join(improvements)}" if improvements else '继续保持当前良好状态',
            f"建议每周围绕 {max(3, round(total_tasks / len(reports)))} 个核心任务展开工作",
            '关注关键成果的输出，将工作内容与团队目标对齐'
        ],
        'weeklySummaries': [{
            'week': r.get('weekLabel'),
            'tasks': r.get('tasks', []),
            'keyResults': r.get('keyResults', []),
            'issues': r.get('issues', [])
        } for r in reports]
    }


# ======================== HTTP 请求处理器 ========================

class ReportHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]}")

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _read_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length)
            return json.loads(body.decode('utf-8'))
        return {}

    def _parse_path(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')
        params = urllib.parse.parse_qs(parsed.query)
        # 简单处理 params 中只有一个值的
        simple_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
        return path, simple_params

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # ==================== API 路由 ====================

    def do_GET(self):
        path, params = self._parse_path()
        print(f"  GET {path} params={params}")

        try:
            if path == '/api/employees':
                self._send_json(get_employees())

            elif path.startswith('/api/employees/'):
                emp_id = path.split('/api/employees/')[1]
                employees = get_employees()
                emp = next((e for e in employees if e['id'] == emp_id), None)
                if emp:
                    self._send_json(emp)
                else:
                    self._send_json({'error': '员工不存在'}, 404)

            elif path == '/api/reports':
                reports = get_all_reports()
                if 'employeeId' in params:
                    reports = [r for r in reports if r.get('employeeId') == params['employeeId']]
                if 'department' in params:
                    reports = [r for r in reports if r.get('department') == params['department']]
                if 'startDate' in params:
                    reports = [r for r in reports if r.get('weekStart', '') >= params['startDate']]
                if 'endDate' in params:
                    reports = [r for r in reports if r.get('weekEnd', '') <= params['endDate']]
                limit = int(params.get('limit', 100))
                self._send_json(reports[:limit])

            elif path.startswith('/api/reports/') and len(path) > 13:
                report_id = path.split('/api/reports/')[1]
                report_path = os.path.join(REPORTS_DIR, f'{report_id}.json')
                report = read_json(report_path)
                if report:
                    self._send_json(report)
                else:
                    self._send_json({'error': '周报不存在'}, 404)

            elif path == '/api/stats/overview':
                self._handle_stats()

            elif path.startswith('/api/analysis/saved/'):
                emp_id = path.split('/api/analysis/saved/')[1]
                analysis_path = os.path.join(ANALYSIS_DIR, f'{emp_id}.json')
                analysis = read_json(analysis_path)
                if analysis:
                    self._send_json(analysis)
                else:
                    self._send_json({'error': '暂无分析结果'}, 404)

            elif path.startswith('/api/analysis/team/'):
                dept = urllib.parse.unquote(path.split('/api/analysis/team/')[1])
                self._handle_team_analysis(dept)

            elif path.startswith('/api/analysis/'):
                emp_id = path.split('/api/analysis/')[1]
                self._handle_personal_analysis(emp_id)

            else:
                self._serve_static(path)

        except Exception as e:
            print(f"  ERROR: {e}")
            self._send_json({'error': str(e)}, 500)

    def do_POST(self):
        path, params = self._parse_path()
        print(f"  POST {path}")

        try:
            body = self._read_body()

            if path == '/api/login':
                self._handle_login(body)
            elif path == '/api/reports':
                self._handle_submit_report(body)
            else:
                self._send_json({'error': 'Not Found'}, 404)

        except json.JSONDecodeError:
            self._send_json({'error': '无效的JSON格式'}, 400)
        except Exception as e:
            print(f"  ERROR: {e}")
            self._send_json({'error': str(e)}, 500)

    def do_DELETE(self):
        path, params = self._parse_path()
        print(f"  DELETE {path}")

        try:
            if path.startswith('/api/reports/'):
                report_id = path.split('/api/reports/')[1]
                report_path = os.path.join(REPORTS_DIR, f'{report_id}.json')
                if os.path.exists(report_path):
                    os.remove(report_path)
                    self._send_json({'success': True})
                else:
                    self._send_json({'error': '周报不存在'}, 404)
            else:
                self._send_json({'error': 'Not Found'}, 404)
        except Exception as e:
            print(f"  ERROR: {e}")
            self._send_json({'error': str(e)}, 500)

    # ==================== 具体处理逻辑 ====================

    def _handle_login(self, body):
        name = body.get('name', '').strip()
        department = body.get('department', '').strip()

        if not name or not department:
            return self._send_json({'error': '姓名和部门不能为空'}, 400)

        employees = get_employees()
        employee = next((e for e in employees if e['name'] == name and e['department'] == department), None)

        if not employee:
            employee = {
                'id': uuid.uuid4().hex[:8],
                'name': name,
                'department': department,
                'password': body.get('password', ''),
                'createdAt': datetime.now().isoformat(),
                'lastLoginAt': datetime.now().isoformat()
            }
            employees.append(employee)
            write_json(EMPLOYEES_FILE, employees)
        else:
            employee['lastLoginAt'] = datetime.now().isoformat()
            write_json(EMPLOYEES_FILE, employees)

        self._send_json({'success': True, 'employee': employee})

    def _handle_submit_report(self, body):
        employee_id = body.get('employeeId')
        tasks = body.get('tasks', [])

        if not employee_id or not tasks:
            return self._send_json({'error': '员工ID和工作内容不能为空'}, 400)

        week = get_week_range()
        report = {
            'id': uuid.uuid4().hex,
            'employeeId': employee_id,
            'employeeName': body.get('employeeName', ''),
            'department': body.get('department', ''),
            'weekStart': week['weekStart'],
            'weekEnd': week['weekEnd'],
            'weekLabel': week['weekLabel'],
            'tasks': tasks if isinstance(tasks, list) else [tasks],
            'keyResults': body.get('keyResults', []),
            'nextWeekPlan': body.get('nextWeekPlan', []),
            'issues': body.get('issues', []),
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }

        # 检查本周是否已有周报
        existing_reports = [
            r for r in get_all_reports()
            if r['employeeId'] == employee_id and r['weekStart'] == week['weekStart']
        ]

        is_update = False
        if existing_reports:
            existing = existing_reports[0]
            report['id'] = existing['id']
            report['createdAt'] = existing['createdAt']
            report['updatedAt'] = datetime.now().isoformat()
            is_update = True

        write_json(os.path.join(REPORTS_DIR, f"{report['id']}.json"), report)
        self._send_json({'success': True, 'report': report, 'isUpdate': is_update})

    def _handle_stats(self):
        all_reports = get_all_reports()
        employees = get_employees()
        current_week = get_week_range()

        this_week_reports = [r for r in all_reports if r.get('weekStart') == current_week['weekStart']]
        submitted_ids = set(r['employeeId'] for r in this_week_reports)

        # 部门统计
        dept_stats = {}
        for e in employees:
            dept = e['department']
            if dept not in dept_stats:
                dept_stats[dept] = {'total': 0, 'submitted': 0}
            dept_stats[dept]['total'] += 1

        for r in this_week_reports:
            dept = r.get('department', '')
            if dept in dept_stats:
                dept_stats[dept]['submitted'] += 1

        submission_rate = round(len(submitted_ids) / len(employees) * 100) if employees else 0

        self._send_json({
            'totalEmployees': len(employees),
            'totalReports': len(all_reports),
            'thisWeekSubmitted': len(submitted_ids),
            'thisWeekTotal': len(employees),
            'submissionRate': submission_rate,
            'departmentStats': dept_stats,
            'currentWeek': current_week
        })

    def _handle_personal_analysis(self, employee_id):
        employees = get_employees()
        employee = next((e for e in employees if e['id'] == employee_id), None)

        if not employee:
            return self._send_json({'error': '员工不存在'}, 404)

        reports = [r for r in get_all_reports() if r.get('employeeId') == employee_id]
        analysis = generate_performance_analysis(reports, employee)

        write_json(os.path.join(ANALYSIS_DIR, f'{employee_id}.json'), analysis)
        self._send_json(analysis)

    def _handle_team_analysis(self, department):
        employees = [e for e in get_employees() if e.get('department') == department]
        all_reports = [r for r in get_all_reports() if r.get('department') == department]

        members = []
        for emp in employees:
            emp_reports = [r for r in all_reports if r.get('employeeId') == emp['id']]
            if emp_reports:
                analysis = generate_performance_analysis(emp_reports, emp)
                members.append({
                    'employeeId': emp['id'],
                    'employeeName': emp['name'],
                    'reportCount': len(emp_reports),
                    'score': analysis['overallScore'],
                    'level': analysis['performanceLevel'],
                    'completionRate': analysis['summary']['completionRate'],
                    'strengths': analysis['summary']['strengths'],
                    'improvements': analysis['summary']['improvements']
                })

        members.sort(key=lambda m: m['score'], reverse=True)
        scores = [m['score'] for m in members]

        level_dist = {'S': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0}
        for m in members:
            level_dist[m['level']] = level_dist.get(m['level'], 0) + 1

        team_analysis = {
            'department': department,
            'analysisDate': datetime.now().isoformat(),
            'totalEmployees': len(employees),
            'totalReports': len(all_reports),
            'members': members,
            'departmentStats': {
                'averageScore': round(sum(scores) / len(scores)) if scores else 0,
                'maxScore': max(scores) if scores else 0,
                'minScore': min(scores) if scores else 0,
                'memberCount': len(members),
                'levelDistribution': level_dist
            }
        }

        write_json(os.path.join(ANALYSIS_DIR, f'team_{department}.json'), team_analysis)
        self._send_json(team_analysis)

    # ==================== 静态文件服务 ====================

    def _serve_static(self, path):
        if not path or path == '/':
            path = '/index.html'

        file_path = os.path.join(PUBLIC_DIR, path.lstrip('/'))

        # 安全检查
        real_path = os.path.realpath(file_path)
        if not real_path.startswith(os.path.realpath(PUBLIC_DIR)):
            self._send_json({'error': 'Forbidden'}, 403)
            return

        if not os.path.exists(file_path) or os.path.isdir(file_path):
            # 返回 index.html 用于 SPA 路由
            file_path = os.path.join(PUBLIC_DIR, 'index.html')
            if not os.path.exists(file_path):
                self._send_json({'error': 'Not Found'}, 404)
                return

        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            content_type = 'application/octet-stream'

        with open(file_path, 'rb') as f:
            content = f.read()

        self.send_response(200)
        self.send_header('Content-Type', f'{content_type}; charset=utf-8' if 'text' in content_type else content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(content)


# ======================== 启动服务器 ========================

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), ReportHandler)
    print('=' * 50)
    print('  周报管理系统已启动')
    print(f'  http://localhost:{PORT}')
    print('=' * 50)
    print(f'  数据目录: {DATA_DIR}')
    print(f'  员工数据: {EMPLOYEES_FILE}')
    print(f'  周报目录: {REPORTS_DIR}')
    print(f'  分析目录: {ANALYSIS_DIR}')
    print('=' * 50)
    print('  按 Ctrl+C 停止服务器')
    print('=' * 50)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        server.server_close()
