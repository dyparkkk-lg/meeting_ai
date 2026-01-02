/**
 * 마크다운 렌더러
 * 회의 요약 결과를 마크다운 형식으로 변환
 */

interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

interface Evidence {
  startMs: number;
  endMs: number;
  quote: string;
}

interface Decision {
  decision: string;
  evidence: Evidence[];
}

interface ActionItem {
  task: string;
  assigneeCandidate: string | null;
  dueDate: string | null;
  priority: string;
  evidence: Evidence[];
}

interface Risk {
  description: string;
  severity: string;
  evidence: Evidence[];
}

interface OpenQuestion {
  question: string;
  evidence: Evidence[];
}

interface SummaryResult {
  overallSummary: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Risk[];
  openQuestions: OpenQuestion[];
}

interface RenderInput {
  title: string | null;
  segments: TranscriptSegment[];
  summary: Record<string, unknown>;
}

export class MdRenderer {
  render(input: RenderInput): string {
    const { title, segments, summary } = input;
    const result = summary as unknown as SummaryResult;
    const lines: string[] = [];
    const now = new Date().toISOString();

    // Frontmatter
    lines.push('---');
    lines.push(`title: "${title || '회의록'}"`);
    lines.push(`created: ${now}`);
    lines.push(`status: READY`);
    lines.push('---');
    lines.push('');

    // 제목
    lines.push(`# ${title || '회의록'}`);
    lines.push('');

    // 회의 요약
    lines.push('## 📋 회의 요약');
    lines.push('');
    if (result.overallSummary && result.overallSummary.length > 0) {
      for (const summary of result.overallSummary) {
        lines.push(`- ${summary}`);
      }
    } else {
      lines.push('_요약이 없습니다._');
    }
    lines.push('');

    // 결정사항
    lines.push('## ✅ 결정사항');
    lines.push('');
    if (result.decisions && result.decisions.length > 0) {
      for (const decision of result.decisions) {
        lines.push(`### ${decision.decision}`);
        if (decision.evidence && decision.evidence.length > 0) {
          lines.push('');
          lines.push('**근거:**');
          for (const ev of decision.evidence) {
            const time = this.formatTimestamp(ev.startMs, ev.endMs);
            lines.push(`> "${ev.quote}" ${time}`);
          }
        }
        lines.push('');
      }
    } else {
      lines.push('_결정사항이 없습니다._');
      lines.push('');
    }

    // 액션 아이템 (표)
    lines.push('## 📌 액션 아이템');
    lines.push('');
    if (result.actionItems && result.actionItems.length > 0) {
      lines.push('| 우선순위 | 업무 | 담당자 | 기한 |');
      lines.push('|----------|------|--------|------|');
      for (const item of result.actionItems) {
        const assignee = item.assigneeCandidate || '-';
        const dueDate = item.dueDate || '-';
        lines.push(`| ${item.priority || 'P2'} | ${item.task} | ${assignee} | ${dueDate} |`);
      }
      lines.push('');
      
      // 액션 아이템 상세 (근거 포함)
      lines.push('### 상세 근거');
      lines.push('');
      for (let i = 0; i < result.actionItems.length; i++) {
        const item = result.actionItems[i];
        lines.push(`**${i + 1}. ${item.task}**`);
        if (item.evidence && item.evidence.length > 0) {
          for (const ev of item.evidence) {
            const time = this.formatTimestamp(ev.startMs, ev.endMs);
            lines.push(`> "${ev.quote}" ${time}`);
          }
        }
        lines.push('');
      }
    } else {
      lines.push('_액션 아이템이 없습니다._');
      lines.push('');
    }

    // 이슈/리스크
    lines.push('## ⚠️ 이슈 및 리스크');
    lines.push('');
    if (result.risks && result.risks.length > 0) {
      for (const risk of result.risks) {
        const severityEmoji = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
        lines.push(`### ${severityEmoji} ${risk.description}`);
        if (risk.evidence && risk.evidence.length > 0) {
          lines.push('');
          for (const ev of risk.evidence) {
            const time = this.formatTimestamp(ev.startMs, ev.endMs);
            lines.push(`> "${ev.quote}" ${time}`);
          }
        }
        lines.push('');
      }
    } else {
      lines.push('_식별된 리스크가 없습니다._');
      lines.push('');
    }

    // 미결 질문
    if (result.openQuestions && result.openQuestions.length > 0) {
      lines.push('## ❓ 미결 질문');
      lines.push('');
      for (const q of result.openQuestions) {
        lines.push(`- ${q.question}`);
        if (q.evidence && q.evidence.length > 0) {
          for (const ev of q.evidence) {
            const time = this.formatTimestamp(ev.startMs, ev.endMs);
            lines.push(`  > "${ev.quote}" ${time}`);
          }
        }
      }
      lines.push('');
    }

    // 전사 내용 (접기)
    lines.push('## 📝 전체 전사 내용');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>전사 내용 펼치기</summary>');
    lines.push('');
    lines.push('```');
    for (const seg of segments) {
      const time = this.formatTimestamp(seg.startMs, seg.endMs);
      const speaker = seg.speaker ? `[${seg.speaker}]` : '';
      lines.push(`${time} ${speaker} ${seg.text}`);
    }
    lines.push('```');
    lines.push('');
    lines.push('</details>');

    return lines.join('\n');
  }

  private formatTimestamp(startMs: number, endMs: number): string {
    const formatTime = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    return `[${formatTime(startMs)} - ${formatTime(endMs)}]`;
  }
}

