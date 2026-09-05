/**
 * GET `/asis-sample` — 합성 레거시 데모 페이지 (계약 §12).
 *
 * AS-IS 분석 데모·e2e 대상이 되도록 의도된 페인포인트 신호를 담는다 (전부 가상 데이터, 외부 리소스 없음):
 * - h1 없음 (배너는 h2 만) / 레이블 없는 input 3개 / alt 없는 img 2개 (1px data URI)
 * - nav 링크 18개 / 모호한 버튼 문구('클릭', '여기') / caption 없는 표 1개 / iframe 1개(srcdoc) / meta description 없음
 * - 긴 본문 (레거시 안내문)
 *
 * 이 개발 컨테이너는 외부 egress 가 막힐 수 있으므로, AS-IS 분석 데모는 이 자체 제공 페이지를 대상으로 한다.
 */

/** 1×1 투명 GIF data URI (외부 이미지 대신). */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** nav 링크 18개 — 레거시 특유의 평평한 대메뉴. */
const NAV_ITEMS = [
  '상품조회', '견적요청', '견적내역', '발주관리', '납품확인', '정산내역',
  '세금계산서', '반품관리', '재고문의', '단가표', '공지사항', '자료실',
  '자주묻는질문', '1대1문의', '파트너정보', '직원관리', '인증서관리', '사이트맵',
] as const

const NAV_HTML = NAV_ITEMS.map((name, i) => `<a href="#menu-${i + 1}">${name}</a>`).join('\n      ')

export const ASIS_SAMPLE_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>레거시 파트너몰(데모)</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #f4f4f4; color: #222; }
    .banner { background: #2b4a7a; color: #fff; padding: 18px 24px; }
    .banner h2 { margin: 0; font-size: 22px; }
    nav { background: #e8e8e8; padding: 8px 24px; border-bottom: 1px solid #ccc; }
    nav a { margin-right: 12px; font-size: 12px; color: #234; white-space: nowrap; }
    main { padding: 24px; max-width: 960px; }
    .login-box { background: #fff; border: 1px solid #ccc; padding: 16px; margin-bottom: 24px; }
    .login-box input { display: block; margin-bottom: 8px; padding: 6px; width: 220px; }
    table { border-collapse: collapse; background: #fff; margin-bottom: 24px; }
    th, td { border: 1px solid #bbb; padding: 6px 10px; font-size: 13px; }
    iframe { border: 1px solid #999; width: 320px; height: 60px; }
    .notice p { font-size: 13px; line-height: 1.7; }
    button { padding: 6px 14px; margin-right: 8px; }
  </style>
</head>
<body>
  <!-- 제목만 있는 배너 (h1 없음, h2 만) -->
  <header class="banner">
    <h2>레거시 파트너몰(데모)</h2>
  </header>

  <nav>
      ${NAV_HTML}
  </nav>

  <main>
    <section class="login-box">
      <h2>파트너 로그인</h2>
      <!-- 레이블 없는 입력 3개 -->
      <form name="login" action="#login" method="post">
        <input type="text" name="partner_id" placeholder="">
        <input type="password" name="partner_pw" placeholder="">
        <input type="text" name="branch_code" placeholder="">
        <button type="button">클릭</button>
        <button type="button">여기</button>
      </form>
      <!-- alt 없는 이미지 2개 (1px data URI) -->
      <img src="${PIXEL}" width="120" height="40">
      <img src="${PIXEL}" width="120" height="40">
    </section>

    <section>
      <h2>이번 달 견적 현황</h2>
      <!-- caption 없는 표 -->
      <table>
        <tr><th>번호</th><th>품목</th><th>수량</th><th>금액</th><th>상태</th></tr>
        <tr><td>1</td><td>A4 복사용지(데모)</td><td>200</td><td>560,000</td><td>검토중</td></tr>
        <tr><td>2</td><td>토너 카트리지(데모)</td><td>35</td><td>1,890,000</td><td>승인</td></tr>
        <tr><td>3</td><td>사무용 의자(데모)</td><td>12</td><td>2,140,000</td><td>반려</td></tr>
      </table>
      <iframe srcdoc="&lt;p style='font-size:12px'&gt;[점검 안내] 매주 일요일 02:00~04:00 시스템 점검(데모 공지)&lt;/p&gt;"></iframe>
    </section>

    <section class="notice">
      <h2>공지사항</h2>
      <h3>이용 안내</h3>
      <p>본 페이지는 AS-IS 분석 데모를 위한 합성 레거시 파트너몰입니다. 실제 서비스·고객 데이터와 무관하며 모든 수치와 품목은 가상의 값입니다.
      파트너 여러분께서는 로그인 후 견적요청 메뉴에서 견적을 등록하실 수 있으며, 등록하신 견적은 담당자의 검토를 거쳐 승인 또는 반려 처리됩니다.
      승인된 견적은 발주관리 메뉴에서 발주로 전환하실 수 있고, 납품이 완료되면 납품확인 메뉴에서 확인서를 출력하신 뒤 정산내역 메뉴에서 월별 정산 현황을 조회하실 수 있습니다.</p>
      <p>세금계산서는 매월 10일 일괄 발행되며, 발행 내역은 세금계산서 메뉴에서 확인하실 수 있습니다. 반품이 필요한 경우 반품관리 메뉴에서 신청하시고,
      재고가 궁금하신 품목은 재고문의 메뉴를 이용해 주시기 바랍니다. 단가 변동이 있는 경우 단가표 메뉴에 매주 월요일 갱신되오니 발주 전 반드시 확인해 주시기 바랍니다.
      기타 문의사항은 자주묻는질문을 먼저 확인하신 뒤 1대1문의로 접수해 주시면 담당자가 순차적으로 답변드립니다.</p>
      <p>인증서 만료가 임박한 파트너께서는 인증서관리 메뉴에서 갱신 절차를 진행해 주시기 바랍니다. 갱신하지 않으시면 로그인이 제한될 수 있습니다.
      직원 계정의 추가·삭제는 직원관리 메뉴에서 대표 계정으로만 가능합니다. 본 데모 페이지의 모든 링크는 실제로 이동하지 않는 자리표시자입니다.</p>
    </section>
  </main>
</body>
</html>
`
