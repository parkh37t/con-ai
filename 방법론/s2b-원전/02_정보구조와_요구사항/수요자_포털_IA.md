# 수요기관 포털 IA

| 컬럼 | 설명 |
|------|------|
| 대메뉴 | 1단계 메뉴 |
| 중메뉴 | 2단계 메뉴 |
| 소메뉴 | 3단계 메뉴 / 탭 |
| 추가 | 팝업·하위 탭 등 추가 구분 |
| 화면ID | 화면 식별자 |

---

## 1. 메인

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 메인 | 통합검색 | - | - | buy-catalog-Main |
| 메인 | 통합검색 | 검색결과 | - | buy-main-search |
| 메인 | 인근 공급업체 조회 | - | - | buy-main-searchResult |
| 메인 | 인근 공급업체 | 지도+목록 | 260508 재제작 | buy-catalog-nearbysell |

---

## 2. 1인수의 견적정보

GNB 메가메뉴 노출 ? 「서브메인 / 견적등록 / 견적서 접수목록」.

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 1인수의 견적정보 | 서브메인 (S2B몰 + 견적 검색) | - | - | buy-catalog-subMain |
| 1인수의 견적정보 | 서브메인 | 이벤트몰 카드형 진입 | - | buy-catalog-eventMall |
| 1인수의 견적정보 | 견적 상세 | 부가정보 탭 | - | buy-catalog-catalogDetailAddInfoTab |
| 1인수의 견적정보 | 견적 상세 | 상세정보 탭 | - | buy-catalog-sellerSearch |
| 1인수의 견적정보 | 견적 상세 | 이용후기 탭 | - | buy-catalog-catalogDetailReviewTab |
| 1인수의 견적정보 | 견적 상세 | 질문답변 탭 | - | buy-catalog-catalogDetailQuestionTab |
| 1인수의 견적정보 | 견적 상세 | 배송/반품/교환 안내 탭 | - | buy-catalog-catalogDetailDeliveryTab |
| 1인수의 견적정보 | 견적 상세 | 공급업체 상세 정보 팝업 | - | buy-catalog-sellerDetailInfoTab |
| 1인수의 견적정보 | 견적 상세 | 견적 오류 팝업 | - | buy-catalog-QuoteErrorPopup |
| 1인수의 견적정보 | 견적 상세 | 다중 장바구니 선택 팝업 | - | buy-catalog-MultiCartselectPopup |
| 1인수의 견적정보 | 견적 상세 | 공급업체 상세 팝업 | - | buy-catalog-sellerDetailPopup |
| 1인수의 견적정보 | 견적등록 | - | - | buy-catalog-quoteCreate |
| 1인수의 견적정보 | 견적서 접수목록 | - | - | buy-catalog-quoteReceiptList |
| 1인수의 견적정보 | 견적서 접수목록 | 사업담당자 접수 팝업 | - | buy-catalog-userCart-receptionistPopup |
| 1인수의 견적정보 | 견적서 접수목록 | 접수목록 팝업 | - | buy-catalog-userCart-receptionlistPopup |
| 1인수의 견적정보 | 견적서 접수목록 | 조합추천(SMPP) 팝업 | - | buy-catalog-userCart-SMPPopup |
| 1인수의 견적정보 | 견적서 접수목록 | 조합추천(SMPP) 변형 팝업 | - | buy-catalog-userCart-SMPPPopup |
| 1인수의 견적정보 | 1인수의 견적정보 견적서 접수 목록 (구매흐름 보조) | - | - | buy-catalog-userCartlist |
| 1인수의 견적정보 | 거절 팝업 | 구매 거절 | - | buy-catalog-BuyRejectPopup |

> 참고: 카드형 서브메인(`buy-catalog-eventMall`)은 보존하되 진입 동선은 GNB 「서브메인」(=`buy-catalog-subMain`)으로 단일화. `buy-catalog-userCartlist`(1인수의 견적정보 견적서 접수 목록)는 GNB에서 제외하고 구매흐름 내 보조 화면으로 위치.

---

## 3. 1인수의 견적요청

GNB 메가메뉴 미노출 ? 클릭 시 목록 직진입.

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 1인수의 견적요청 | 목록 | - | - | buy-quote-quoteList |
| 1인수의 견적요청 | 상세 | 계약접수 탭 | - | buy-quote-quoteDetailOrderApplyTab |
| 1인수의 견적요청 | 상세 | 업체선정 탭 | - | buy-quote-quoteDetailSelectionTab |
| 1인수의 견적요청 | 상세 | 견적요청 등록 | - | buy-quote-quoteCreate |
| 1인수의 견적요청 | 상세 | 통합 상세(탭 통합본) | - | buy-quote-quoteDetailOrderApplyTab |

---

## 4. 2인수의 안내공고

GNB 메가메뉴 미노출 ? 클릭 시 목록 직진입.

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 2인수의 안내공고 | 목록 | - | - | buy-posting-PostingList |
| 2인수의 안내공고 | 상세 | 계약접수 탭 | - | buy-posting-postingDetailOrderApplyTab |
| 2인수의 안내공고 | 상세 | 업체선정 탭 | - | buy-posting-postingDetailSelectionTab |
| 2인수의 안내공고 | 상세 | 통합 상세(탭 통합본) | - | buy-posting-postingDetail_OrderApplyTab_SelectionTab |

---

## 5. 입찰

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 입찰 | 목록 | - | - | buy-bid-bidList |
| 입찰 | 상세 | 계약접수 | - | buy-bid-bidDetailOrderApplyTab |
| 입찰 | 상세 | 업체선정 | - | buy-bid-bidDetailSelectionTab |

---

## 6. 연계정보

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 연계정보 | 발주계획 | 목록(S2B) | - | buy-receipt-budgetS2BList |
| 연계정보 | 발주계획 | 목록(에듀파인) | - | buy-receipt-budgetEdufineList |
| 연계정보 | 발주계획 | 목록(G2B) | - | buy-receipt-budgetG2BList |
| 연계정보 | 발주계획 | 상세 | - | buy-receipt-budgetDetail |
| 연계정보 | 사전규격 | 목록(S2B) | - | buy-receipt-prespecS2BList |
| 연계정보 | 사전규격 | 목록(에듀파인) | - | buy-receipt-prespecEdufineList |
| 연계정보 | 사전규격 | 목록(G2B) | - | buy-receipt-prespecG2BList |
| 연계정보 | 사전규격 | 상세 | - | buy-receipt-prespecDetail |
| 연계정보 | 사전규격 | 상세 | 사전규격 공급업체 의견 상세 | buy-receipt-prespecSellerOpinionDetail |

---

## 7. 리포팅/통계

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 리포팅/통계 | 공공구매 실적 목록 | - | - | buy-mydesk-contract-publicBuyList |
| 리포팅/통계 | 공공구매 실적 등록 | - | - | buy-mydesk-contract-publicBuyCreate |
| 리포팅/통계 | 공공구매 실적 상세 | - | - | buy-mydesk-contract-publicBuyDetail |
| 리포팅/통계 | 계약실적 조회 | - | - | Null |
| 리포팅/통계 | 공급업체 통계정보 | 상위업체 | - | buy-report-topSeller |
| 리포팅/통계 | 공급업체 통계정보 | 계약유형 | - | buy-report-sellerServiceType |
| 리포팅/통계 | 공급업체 통계정보 | 지역분포 | - | buy-report-sellerRegion |
| 리포팅/통계 | 공급업체 통계정보 | 구매기관 구매실적 조회 | - | buy-report-buyerPurchased |
| 리포팅/통계 | 공급업체 통계정보 | 교육청별 실적 조회 | - | buy-report-buyerByEdu |

---

## 8. 알림/커뮤니케이션

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 알림/커뮤니케이션 | 커뮤니티 관리 | 목록 | - | buy-notification-communityList |
| 알림/커뮤니케이션 | 커뮤니티 관리 | 상세 | - | buy-notification-communityDetail |
| 알림/커뮤니케이션 | 커뮤니티 관리 | 신고 | - | buy-notification-communityClaim |
| 알림/커뮤니케이션 | 커뮤니티 관리 | 공지 상세 | - | buy-notification-communityNotice |
| 알림/커뮤니케이션 | 커뮤니티 관리 | 등록/수정 | - | buy-notification-communityCreate |
| 알림/커뮤니케이션 | 커뮤니티 관리 | 카탈로그 선택 (별창 모달) | - | buy-notification-communityCatalogSelectBulkPopup |
| 알림/커뮤니케이션 | 체험단 | 목록 | - | buy-notification-testerList |
| 알림/커뮤니케이션 | 체험단 | 상세 | - | buy-notification-testerDetail |
| 알림/커뮤니케이션 | 체험단 | 신청 | - | buy-notification-testerApply |
| 알림/커뮤니케이션 | 체험단 | 후기등록 | - | buy-notification-testerReviewCreate |
| 알림/커뮤니케이션 | 이벤트 | 목록 | - | buy-notification-eventList |
| 알림/커뮤니케이션 | 이벤트 | 상세 | - | buy-notification-eventDetail |
| 알림/커뮤니케이션 | 이벤트 | 참가 신청 | - | buy-notification-eventApply |
| 알림/커뮤니케이션 | 이벤트 | 결과 조회 | - | buy-notification-eventResult |

---

## 9. 고객지원

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 고객지원 | S2B 안내 | 소개 | - | buy-support-introduce |
| 고객지원 | S2B 안내 | 연혁 | - | buy-support-history |
| 고객지원 | S2B 안내 | CI | - | buy-support-bi |
| 고객지원 | S2B 안내 | 지역센터 안내 | - | buy-support-center |
| 고객지원 | S2B 이용 우수기관 | 조달건수 | - | buy-support-awardCount |
| 고객지원 | S2B 이용 우수기관 | 조달금액 | - | buy-support-awardAmount |
| 고객지원 | S2B경험행사 | 목록 | - | buy-support-campaignList |
| 고객지원 | S2B경험행사 | 상세 | - | buy-support-campaignDetail |
| 고객지원 | 용어사전 | - | - | buy-support-dictionary |
| 고객지원 | 체험단 | - | - | buy-support-trial |
| 고객지원 | 모바일서비스 | - | - | buy-support-mobileService |
| 고객지원 | 온라인매뉴얼 | - | - | buy-support-manual |
| 고객지원 | 교육연수 신청 | 리스트목록 | - | buy-support-trainingList |
| 고객지원 | 교육연수 신청 | 캘린더목록 | - | buy-support-trainingCalendar |
| 고객지원 | 교육연수 신청 | 상세 | - | buy-support-trainingDetail |
| 고객지원 | 교육연수 신청 | 방문교육신청 | - | buy-support-trainingVisitCreate |
| 고객지원 | 공지사항 | 목록 | - | buy-support-noticeList |
| 고객지원 | 공지사항 | 상세 | - | buy-support-noticeDetail |
| 고객지원 | FAQ | 목록 | - | buy-support-faq |
| 고객지원 | 고객센터안내 | 상세 | - | buy-support-ars |
| 고객지원 | 법령 자료실 | 목록 | - | buy-support-lawhubList |
| 고객지원 | 법령 자료실 | 상세 | - | buy-support-lawHubDetail |
| 고객지원 | 통합 자료실 | 목록 | - | buy-support-commonsHubList |
| 고객지원 | 통합 자료실 | 상세 | - | buy-support-commonsHubDetail |
| 고객지원 | PR센터 | 미디어 | - | buy-support-media |
| 고객지원 | PR센터 | 브로슈어 | - | buy-support-brochure |
| 고객지원 | PR센터 | 뉴스룸 | 목록 | buy-support-newsroomList |
| 고객지원 | PR센터 | 뉴스룸 | 상세 | buy-support-newsroomDetail |
| 고객지원 | 통합로그인 서비스 | 회원안내 | - | buy-support-MembershipInfo |
| 고객지원 | 통합로그인 서비스 | 로그인안내 | - | buy-support-loginInfo |
| 고객지원 | 통합로그인 서비스 | 인증서안내 | - | buy-support-certificateInfo |
| 고객지원 | 통합로그인 서비스 | 시스템이용도우미 | - | buy-support-systemHelp |
| 고객지원 | 사이트 이용정책 | 이용약관 | - | buy-support-terms |
| 고객지원 | 사이트 이용정책 | 개인정보처리방침 | - | buy-support-selfPrivacy |
| 고객지원 | 1:1문의 등록 팝업 | - | - | buy-support-askCreate-popup |

---

## 10. 마이데스크

### 10.1 대시보드 / 관심공고

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 대시보드 | - | - | buy-mydesk-contract-dashboard |
| 마이데스크 | 관심공고 | 목록 | - | buy-mydesk-contract-wishlist |

### 10.2 계약현황

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 계약현황 | 계약접수 목록 | - | buy-mydesk-contract-orderApplyList |
| 마이데스크 | 계약현황 | 계약접수 임시저장 목록 | - | buy-mydesk-contract-pendingList |
| 마이데스크 | 계약현황 | 1인수의 견적정보 견적서 접수 목록 | - | buy-mydesk-selection-contractList |
| 마이데스크 | 계약현황 | 1인수의 견적정보 견적서 접수 목록 | 수의시담 요청 | buy-mydesk-selection-contractNegoDetail |
| 마이데스크 | 계약현황 | 1인수의 견적정보 견적서 접수 목록 | 계약체결자격 확인 팝업 | buy-mydesk-selection-contractAbilityPass |
| 마이데스크 | 계약현황 | 1인수의 견적정보 견적서 접수 목록 | 계약체결자격 부적격 업체 제외 | buy-mydesk-selection-contractAbilityFail |
| 마이데스크 | 계약현황 | 1인수의 견적정보 사업담당자 계약요청 목록(가칭) | - | buy-mydesk-receipt-catalogCartCheck |
| 마이데스크 | 계약현황 | 계약목록 | - | buy-mydesk-contract-contractList |
| 마이데스크 | 계약현황 | 수의시담 | 목록 | buy-mydesk-selection-negoList |
| 마이데스크 | 계약현황 | 수의시담 | 1인수의 견적정보 수의시담 상세 | buy-mydesk-selection-catalogNegoDetail |
| 마이데스크 | 계약현황 | 수의시담 | 1인수의 견적요청 수의시담 상세 | buy-mydesk-selection-quoteNegoDetail |
| 마이데스크 | 계약현황 | 수의시담 | 수의시담 취소 요청 | buy-mydesk-selection-negoCancelPopup |
| 마이데스크 | 계약현황 | 수의시담 | 1인수의 견적정보 수의시담 요청 | buy-mydesk-selection-catalogNegoCreate |
| 마이데스크 | 계약현황 | 수의시담 | 1인수의 견적요청 수의시담 요청 | buy-mydesk-selection-quoteNegoCreate |

### 10.3 1인수의 견적정보

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 1인수의 견적정보 | 계약상대자결정 | - | buy-mydesk-selection-catalogSellerPick |
| 마이데스크 | 1인수의 견적정보 | 계약 상세 | 업체선정 탭 | buy-mydesk-catalog-catalogDetailSelectionTab |
| 마이데스크 | 1인수의 견적정보 | 계약 상세 | 계약체결 탭 | buy-mydesk-catalog-catalogDetailExecutionTab |
| 마이데스크 | 1인수의 견적정보 | 계약 상세 | 검수 탭 | buy-mydesk-catalog-catalogDetailInspectionTab |
| 마이데스크 | 1인수의 견적정보 | 계약 상세 | 결제 탭 | buy-mydesk-catalog-catalogDetailPaymentTab |
| 마이데스크 | 1인수의 견적정보 | 계약 상세 | 문서함 탭 | buy-mydesk-catalog-catalogDetailInboxDetail |

### 10.4 1인수의 견적요청

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 1인수의 견적요청 | 견적요청 등록 | - | buy-mydesk-quote-quoteCreate |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 상세조회 팝업 | buy-quote-quoteDetailPopup |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 계약접수 탭 | buy-mydesk-quote-quoteDetailOrderApplyTab |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 업체선정 탭 | buy-mydesk-quote-quoteDetailSelectionTab |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 업체선정 탭 (수의시담 요청) | buy-mydesk-quote-quoteDetailSelectionNegoDetail |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 견적조회(견적요청) | buy-mydesk-quote-quoteCompare |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 계약체결 탭 | buy-mydesk-quote-quoteDetailExecutionTab |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 검수 탭 | buy-mydesk-quote-quoteDetailInspectionTab |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 결제 탭 | buy-mydesk-quote-quoteDetailPaymentTab |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 문서함 탭 | buy-mydesk-quote-quoteDetailInboxDetail |
| 마이데스크 | 1인수의 견적요청 | 견적요청 상세 | 견적요청 수정 | buy-mydesk-quote-quoteDetailUpdate |

### 10.5 2인수의 안내공고

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 2인수의 안내공고 | 공고 목록 | - | buy-mydesk-posting-postingCreate |
| 마이데스크 | 2인수의 안내공고 | 공고 등록 | - | buy-mydesk-posting-postingListSearch |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 상세조회 팝업 | buy-mydesk-posting-postingDetailPopup |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 계약접수 탭 | buy-mydesk-posting-postingDetailOrderApplyTab |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 업체선정 탭 | buy-mydesk-posting-postingDetailSelectionTab |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 견적조회(안내공고) | buy-mydesk-selection-postingCompare |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 안내공고 물품(공사/용역) | buy-mydesk-posting-postingNoticeSampleGoods |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 안내공고 공사 | buy-mydesk-posting-postingNoticeSampleConstruction |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 안내공고 용역 | buy-mydesk-posting-postingNoticeSampleServices |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 안내공고 인쇄 양식 | buy-mydesk-posting-postingNoticeSamplePrint |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 계약체결 탭 | buy-mydesk-posting-postingDetailExecutionTab |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 검수 탭 | buy-mydesk-posting-postingDetailInspectionTab |
| 마이데스크 | 2인수의 안내공고 | 공고 상세 | 결제 탭 | buy-mydesk-posting-postingDetailPaymentTab |
| 마이데스크 | 2인수의 안내공고 | 상세 | 문서함 탭 | buy-mydesk-posting-postingDetailInboxDetail |
| 마이데스크 | 2인수의 안내공고 | 상세 | 정정 팝업 | buy-mydesk-selection-postingUpdatePopup |
| 마이데스크 | 2인수의 안내공고 | 상세 | 정정 | buy-mydesk-posting-postingUpdate |
| 마이데스크 | 2인수의 안내공고 | 상세 | 신규등록 | buy-mydesk-selection-postingRenewCreate |
| 마이데스크 | 2인수의 안내공고 | 상세 | 취소 | buy-mydesk-selection-postingCancelPopup |

### 10.6 입찰

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 입찰 | 입찰 등록 | - | buy-mydesk-bid-bidCreate |
| 마이데스크 | 입찰 | 입찰 등록 | 상세조회 팝업 | buy-mydesk-bid-bidDetailPopup |
| 마이데스크 | 입찰 | 입찰 등록 | 낙찰자결정방법 설정 팝업 | buy-mydesk-bid-screeningMethod |
| 마이데스크 | 입찰 | 입찰 상세 | 계약접수 탭 | buy-mydesk-bid-bidDetailOrderApplyTab |
| 마이데스크 | 입찰 | 입찰 상세 | 업체선정 탭 | buy-mydesk-bid-bidDetailSelectionTab |
| 마이데스크 | 입찰 | 입찰 상세 | 계약체결 탭 | buy-mydesk-bid-bidDetailExecutionTab |
| 마이데스크 | 입찰 | 입찰 상세 | 검수 탭 | buy-mydesk-bid-bidDetailInspectionTab |
| 마이데스크 | 입찰 | 입찰 상세 | 결제 탭 | buy-mydesk-bid-bidPaymentTab |
| 마이데스크 | 입찰 | 입찰 상세 | 문서함 탭 | buy-mydesk-bid-bidDetailInboxDetail |
| 마이데스크 | 입찰 | 입찰 상세 | 적격심사 수행 팝업 | buy-mydesk-selection-bidSellerScorePopup |
| 마이데스크 | 입찰 | 입찰 상세 | 기술능력 심사 수행 팝업 | buy-mydesk-selection-bidSellerEvalScorePopup |
| 마이데스크 | 입찰 | 입찰 상세 | 규격심사 수행 팝업 | buy-mydesk-selection-bidSellerSpecScorePopup |
| 마이데스크 | 입찰 | 입찰 상세 | 유찰 등록 | buy-mydesk-selection-bidVoidPopup |

### 10.7 이용수수료 지급현황

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 결제 | - | buy-mydesk-payment-creditPayment |
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 상세내역 | - | buy-mydesk-settlement-payFeeDetail |
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 선불 요청 | - | buy-mydesk-settlement-requestFeeBill |
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 환불 요청 | - | buy-mydesk-settlement-refundFeeRequest |
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 환불 요청 상세 | - | buy-mydesk-settlement-refundFeeRequestDetail |
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 환불 요청 승인 | - | buy-mydesk-settlement-refundFeeReqAp |
| 마이데스크 | 이용수수료 지급현황 | 이용수수료 세금계산서 | - | buy-mydesk-settlement-taxStampList |

### 10.8 연계정보관리

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 연계정보관리 | 에듀파인 연계정보 | 목록 | buy-mydesk-receipt-edufineInterfaceList |
| 마이데스크 | 연계정보관리 | 에듀파인 연계정보 | 연계해제 | buy-mydesk-receipt-edufineInterfaceUnlink |
| 마이데스크 | 연계정보관리 | 에듀파인 연계정보 | 상세 | buy-mydesk-receipt-edufineInterfaceDetail |
| 마이데스크 | 연계정보관리 | 에듀파인 품의정보 | 목록 | buy-mydesk-receipt-edufineApprovalList |
| 마이데스크 | 연계정보관리 | 에듀파인 품의정보 | 상세 | buy-mydesk-receipt-edufineApprovalDetail |
| 마이데스크 | 연계정보관리 | 조합추천 수의계약 정보 | 목록 | buy-mydesk-receipt-smpplist |
| 마이데스크 | 연계정보관리 | 조합추천 수의계약 정보 | 상세 | buy-mydesk-receipt-smppDetail |
| 마이데스크 | 연계정보관리 | 조합추천 수의계약 정보 | 취소사유 입력 팝업 | buy-receipt-smppCancelPopup |
| 마이데스크 | 연계정보관리 | 조합추천 수의계약 정보 | 조합 검색 팝업 | buy-receipt-smppUnionSearchPopup |
| 마이데스크 | 연계정보관리 | 조합추천 수의계약 정보 | 중소기업자간 경쟁제품 검색 팝업 | buy-receipt-smppSmallSellerSearchPopup |
| 마이데스크 | 연계정보관리 | 발주계획 | 목록(S2B) | buy-mydesk-receipt-budgetS2BList |
| 마이데스크 | 연계정보관리 | 발주계획 | 목록(에듀파인) | buy-mydesk-receipt-budgetEdulineList |
| 마이데스크 | 연계정보관리 | 발주계획 | 목록(G2B) | buy-mydesk-receipt-budgetG2BList |
| 마이데스크 | 연계정보관리 | 발주계획 | 상세 | buy-mydesk-receipt-budgetDetail |
| 마이데스크 | 연계정보관리 | 사전규격 | 목록(S2B) | buy-mydesk-receipt-prespecS2BList |
| 마이데스크 | 연계정보관리 | 사전규격 | 목록(에듀파인) | buy-mydesk-receipt-prespecEdulineList |
| 마이데스크 | 연계정보관리 | 사전규격 | 목록(G2B) | buy-mydesk-receipt-prespecG2BList |
| 마이데스크 | 연계정보관리 | 사전규격 | 상세 | buy-mydesk-receipt-prespecDetail |
| 마이데스크 | 연계정보관리 | 사전규격 | 사전규격 공급업체 의견 상세 | buy-mydesk-receipt-prespecSellerOpinionDetail |
| 마이데스크 | 연계정보관리 | 사전규격 | 등록 | buy-mydesk-receipt-prespecCreate |

### 10.9 계약공통업무

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 계약공통업무 | 발주계획 검색 | - | buy-receipt-budgetEdulineSearch |
| 마이데스크 | 계약공통업무 | 사전규격 검색 | - | buy-receipt-prespecSearch |
| 마이데스크 | 계약공통업무 | 에듀파인 연계 검색 | - | buy-receipt-edufineInterfaceSearch |
| 마이데스크 | 계약공통업무 | 조합추천(SMPP) 검색 | - | buy-receipt-smppSearch |
| 마이데스크 | 계약공통업무 | 제한업종 검색 | - | buy-contract-limitSectorSearch |
| 마이데스크 | 계약공통업무 | S2B 물품번호 조회 | - | buy-contract-catalogNumberSearch |
| 마이데스크 | 계약공통업무 | 국세청 통합인증 팝업 | - | buy-contract-recept-orderPopup |
| 마이데스크 | 계약공통업무 | 조달청 인증 팝업 | - | buy-contract-taxLinkPassPopup |
| 마이데스크 | 계약공통업무 | G2B 인증 팝업 | - | buy-contract-g2bPassPopup |
| 마이데스크 | 계약공통업무 | 에듀파인 인증 팝업 | - | buy-contract-edufinePassPopup |
| 마이데스크 | 계약공통업무 | 공급업체 정보 조회 팝업 | - | buy-contract-sellerDocumentPopup |
| 마이데스크 | 계약공통업무 | 견적서 총액 확인 | - | buy-contract-estimateTotalAmount |
| 마이데스크 | 계약공통업무 | 견적서 오류 체크 | - | buy-contract-estimateUnitPrice |
| 마이데스크 | 계약공통업무 | 업체선정 불가 | - | buy-contract-sellerInvalidPopup |
| 마이데스크 | 계약공통업무 | 임시저장 확인 팝업 | - | buy-contract-tempDataConfirmPopup |
| 마이데스크 | 계약공통업무 | 임시저장 삭제 팝업 | - | buy-contract-tempDataDeletePopup |
| 마이데스크 | 계약공통업무 | 계약 생성 | - | buy-contract-Create |
| 마이데스크 | 계약공통업무 | 수입인지 구매 팝업 | - | buy-contract-receptStampBuyPopup |
| 마이데스크 | 계약공통업무 | 인지세 납부결과조회 | - | buy-contract-receptStamptaxDetailPopup |
| 마이데스크 | 계약공통업무 | 계약상대자 취소 팝업 | - | buy-mydesk-selection-postingSellerSelectCancelPopup |
| 마이데스크 | 계약공통업무 | 계약 해제/해지 요청 | - | buy-mydesk-execution-draftRelease |
| 마이데스크 | 계약공통업무 | 계약 해제/해지 검토 | - | buy-mydesk-execution-draftReleaseCheck |
| 마이데스크 | 계약공통업무 | 공급업체 신고 팝업 | - | buy-mydesk-execution-draftCheckReport |
| 마이데스크 | 계약공통업무 | 검수요청 등록 | - | buy-mydesk-inspection-deliveryRequestCreate |
| 마이데스크 | 계약공통업무 | 검수요청 상세 | - | buy-mydesk-inspection-deliveryRequestDetail |
| 마이데스크 | 계약공통업무 | 검수요청 조회 | - | buy-mydesk-inspection-inspectionRequestDetail |
| 마이데스크 | 계약공통업무 | 배송조회 팝업 | - | buy-mydesk-inspection-deliverySearchPopup |
| 마이데스크 | 계약공통업무 | 검수판정 | - | buy-mydesk-inspection-inspectionCreate |
| 마이데스크 | 계약공통업무 | 검수요청 반려 | - | buy-mydesk-inspection-inspectionRequestReject |
| 마이데스크 | 계약공통업무 | 검수요청 취소 | - | buy-mydesk-inspection-uninspectRequest |
| 마이데스크 | 계약공통업무 | 만족도평가 | - | buy-mydesk-inspection-evalPopup |
| 마이데스크 | 계약공통업무 | 선금 신청 검토 | - | buy-mydesk-payment-prepayAccept |
| 마이데스크 | 계약공통업무 | 결제 반려 | - | buy-mydesk-payment-rejectPopup |
| 마이데스크 | 계약공통업무 | 기성금 신청 검토 | - | buy-mydesk-payment-progressAccept |
| 마이데스크 | 계약공통업무 | 기성금 신청 상세 | - | buy-mydesk-payment-progressDetailPopup |
| 마이데스크 | 계약공통업무 | 잔금 신청 검토 | - | buy-mydesk-payment-balanceAccept |
| 마이데스크 | 계약공통업무 | 잔금 신청 상세 | - | buy-mydesk-payment-balanceDetailPopup |
| 마이데스크 | 계약공통업무 | 일괄지급 신청 검토 | - | buy-mydesk-payment-paymentAccept |
| 마이데스크 | 계약공통업무 | 일괄지급 상세 | - | buy-mydesk-payment-paymentDetailPopup |
| 마이데스크 | 계약공통업무 | 국세/지방세 완납여부 조회 | - | buy-mydesk-payment-taxClearCheckPopup |

### 10.10 공급업체 정보

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 공급업체 정보 | 업체제한관리 | 목록 | buy-mydesk-selection-limitSellerList |
| 마이데스크 | 공급업체 정보 | 업체제한관리 | 상세 | buy-mydesk-selection-limitSellerDetail |
| 마이데스크 | 공급업체 정보 | 검수관리 | 목록 | buy-mydesk-inspection-rejectionList |
| 마이데스크 | 공급업체 정보 | 검수관리 | 상세 | buy-mydesk-inspection-rejectionDetail |
| 마이데스크 | 공급업체 정보 | 검수관리 | 등록 | buy-mydesk-inspection-rejectionCreate |
| 마이데스크 | 공급업체 정보 | 카탈로그 오류 | 목록 | buy-mydesk-catalog-catalogErrorList |
| 마이데스크 | 공급업체 정보 | 카탈로그 오류 | 상세 | buy-mydesk-catalog-catalogErrorDetail |
| 마이데스크 | 공급업체 정보 | 카탈로그 오류 | 등록 | buy-mydesk-catalog-catalogErrorCreate |
| 마이데스크 | 공급업체 정보 | 관심공고 | 목록 | buy-mydesk-contract-wishSellerList |
| 마이데스크 | 공급업체 정보 | 관심공고 | 상세 | buy-mydesk-contract-wishSellerDetail |
| 마이데스크 | 공급업체 정보 | 관심상품 | 목록 | buy-mydesk-contract-wishCatalog-sharequote |
| 마이데스크 | 공급업체 정보 | 관심상품 | 상세 | buy-mydesk-contract-wishCatalog-sharequoteDetail |

### 10.11 커뮤니티 관리

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 커뮤니티 관리 | 좋아요 게시글 | 목록 | buy-mydesk-support-communityList |
| 마이데스크 | 커뮤니티 관리 | 좋아요 게시글 | 상세 | buy-mydesk-support-communityDetail |
| 마이데스크 | 커뮤니티 관리 | 스크랩 게시글 | 목록 | buy-mydesk-support-communityLike |
| 마이데스크 | 커뮤니티 관리 | 스크랩 게시글 | 상세 | buy-mydesk-support-communityScrap |
| 마이데스크 | 커뮤니티 관리 | 신고 게시글/댓글 | 목록 | buy-mydesk-support-communityClaimList |
| 마이데스크 | 커뮤니티 관리 | 신고 게시글/댓글 | 상세 | buy-mydesk-support-communityClaimDetail |

### 10.12 알림함

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 알림함 | 목록 | - | buy-mydesk-notificationList |
| 마이데스크 | 알림함 | 상세 | - | buy-mydesk-notificationDetail |
| 마이데스크 | 알림함 | 설정 | - | buy-mydesk-notificationSetting |

### 10.13 평가

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 평가 | 업체 만족도 | - | buy-mydesk-inspection-GoodsReview |
| 마이데스크 | 평가 | 만족도 | - | buy-mydesk-inspection-SellerReview |

### 10.14 1:1 문의

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 1:1 문의 | 목록 | - | buy-mydesk-support-askList |
| 마이데스크 | 1:1 문의 | 상세 | - | buy-mydesk-support-askDetail |
| 마이데스크 | 1:1 문의 | 등록 | - | buy-mydesk-support-askCreate |

### 10.15 교육연수 신청관리

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 교육연수 신청관리 | 교육연수 목록 | - | buy-mydesk-support-trainingList |
| 마이데스크 | 교육연수 신청관리 | 교육연수 상세 | - | buy-mydesk-support-trainingDetail |
| 마이데스크 | 교육연수 신청관리 | 방문신청 목록 | - | buy-mydesk-support-trainingOfflineList |
| 마이데스크 | 교육연수 신청관리 | 방문신청 상세 | - | buy-mydesk-support-trainingOfflineDetail |

### 10.16 개인이용자 승인

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 개인이용자 승인 | 이용자 관리 목록 | - | buy-member-memberList |
| 마이데스크 | 개인이용자 승인 | 기본정보등록 | - | buy-member-memberbasicInfo |
| 마이데스크 | 개인이용자 승인 | 이용자 상세 | - | buy-member-memberDetail |
| 마이데스크 | 개인이용자 승인 | 이용자 반려 | - | buy-member-memberReject |
| 마이데스크 | 개인이용자 승인 | 이용자 승인 | - | buy-member-memberApproval |
| 마이데스크 | 개인이용자 승인 | 승인완료 | - | buy-member-memberDone |
| 마이데스크 | 개인이용자 승인 | 이용자 소속 삭제 | - | buy-member-memberCompanyDelete |

### 10.17 마이페이지 (신규)

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 마이페이지 | 개인이용자 탈퇴 (신규) | - | S2B-DMD-MYPAGE-002_개인이용자탈퇴 |

> 참고: 마이페이지 메인(`S2B-DMD-MYPAGE-001`)은 `index.html` IA 카탈로그에 등록되어 있으며 본 IA md에는 별도 라인 미기재(필요 시 추후 분리 등록). `MYPAGE-002`는 단순 개인이용자 탈퇴 동선이며 `10.18 이용자그룹관리`의 `buy-mydesk-member-Withdrawal`(소속기관/그룹 탈퇴 다단계)와 별개.

### 10.18 이용자그룹관리

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 마이데스크 | 이용자그룹관리 | 그룹 목록 | - | buy-member-groupList |
| 마이데스크 | 이용자그룹관리 | 그룹 상세 | - | buy-member-groupDetail |
| 마이데스크 | 이용자그룹관리 | 이용자 조회 팝업 | - | buy-member-searchMember |
| 마이데스크 | 이용자그룹관리 | 그룹 등록 | - | buy-member-groupCreate |
| 마이데스크 | 이용자그룹관리 | 이용자 추가 | - | buy-member-groupAddMember |
| 마이데스크 | 이용자그룹관리 | 법인카드 등록(팝업) | - | buy-member-governmentComcardCreateList |
| 마이데스크 | 이용자그룹관리 | 법인카드 등록 | - | buy-member-governmentComcardCreate |
| 마이데스크 | 이용자그룹관리 | 회원정보수정 | 기관정보수정 | buy-mydesk-member-profileUpdate |
| 마이데스크 | 이용자그룹관리 | 회원정보수정 | 관리자 정보수정 | buy-organizationinfo / buy-masterUpdateinfo |
| 마이데스크 | 이용자그룹관리 | 회원탈퇴 | 수요기관탈퇴 | buy-mydesk-member-Withdrawal |
| 마이데스크 | 이용자그룹관리 | 회원탈퇴 | 소속기관탈퇴 | buy-mydesk-member-Leave |
| 마이데스크 | 이용자그룹관리 | 회원탈퇴 | 소속기관탈퇴 완료 | buy-mydesk-member-Withdrawalclear |
| 마이데스크 | 이용자그룹관리 | 회원탈퇴 | 소속기관탈퇴 완료(최종) | buy-mydesk-member-Leaveclear |

---

## 11. 회원가입

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 회원가입 | 통합 가입 | 수요기관 회원가입 (신규) | 약관·기본정보·완료 통합 스텝 | buy-member-signup_수요기관회원가입 |
| 회원가입 | 통합 가입 | 이용약관 (신규) | 통합 약관 페이지 | terms_이용약관 |
| 회원가입 | 아이디 찾기 | 아이디 찾기 | 통합 스텝 (신규 본문) | buy-find-id_아이디찾기 |
| 회원가입 | 아이디 찾기 | 아이디 찾기 (분리본·보존) | - | buy-member-searchId |
| 회원가입 | 아이디 찾기 | 아이디 찾기 결과 (분리본·보존) | - | buy-member-searchIdResult |
| 회원가입 | 비밀번호 재설정 | 비밀번호 재설정 | 통합 스텝 (신규 본문) | buy-reset-pw_비밀번호재설정 |
| 회원가입 | 비밀번호 재설정 | 비밀번호 재설정 (분리본·보존) | - | buy-member-resetPassword |
| 회원가입 | 비밀번호 재설정 | 신규 비밀번호 입력 (분리본·보존) | - | buy-member-newPassword |
| 회원가입 | 교육디지털원패스 로그인 | 팝업 | - | buy-member-eduAuthLogin |
| 회원가입 | 로그인 | 로그인 | - | buy-mydesk-member-loginPopup |

> 회원가입 통합본(`buy-member-signup_수요기관회원가입`)은 `BUY-H-MM-0201 약관동의 + 0204 기본정보 입력 + 0205 회원가입 완료`를 단일 페이지에 스텝 인디케이터로 통합한 화면. 기존 분리본은 IA 보존을 위해 유지(공존).

---

## 12. 개인이용자 등록

| 대메뉴 | 중메뉴 | 소메뉴 | 추가 | 화면ID |
|--------|--------|--------|------|--------|
| 개인이용자 등록 | 소속기관 조회 | 행정표준기관 조회 팝업 | - | buy-member-searchGovernmentCode |
| 개인이용자 등록 | 소속기관 조회 | S2B이용기관 조회 팝업 | - | buy-member-searchCompanyID |
| 개인이용자 등록 | 이용약관 | 이용약관 동의 | - | buy-member-agreeTermsOfUse |
| 개인이용자 등록 | 이용약관 | 결제대행 이용약관 | - | buy-member-agreePayment |
| 개인이용자 등록 | 이용약관 | 개인정보수집 이용약관 | - | buy-member-agreePrivacyPolicyConsent |
| 개인이용자 등록 | 이용약관 | 개인정보수집 이용안내(팝업) | - | buy-member-agreePrivacyPolicyConsentpopup |
| 개인이용자 등록 | 이용약관 | 안내홍보 정보수신(팝업) | - | buy-member-agreePublicityPopup |
| 개인이용자 등록 | 기관정보 등록(관리자) | 법인카드 등록 | - | buy-member-governmentComcardCreate |
| 개인이용자 등록 | 기관정보 등록(관리자) | 기관정보 등록 | - | buy-member-governmentCodeCreate |
| 개인이용자 등록 | 기관정보 등록(관리자) | 담당자정보 등록 | - | buy-member-masterCreate |
| 개인이용자 등록 | 기관정보 등록(관리자) | 인증서 등록 | - | buy-member-companyCertCreate |
| 개인이용자 등록 | 기관정보 등록(관리자) | 가상계좌 조회 | - | buy-member-companyDeposit |
| 개인이용자 등록 | 기관정보 등록(관리자) | 법인카드 등록(KCB) | 260508 신규 | buy-member-accessKcbPopup |
| 개인이용자 등록 | 관리자 운영 | 승인 목록(다건 선택) | 260508 신규 | buy-member-companionList |
| 개인이용자 등록 | 관리자 운영 | 권한관리(메뉴 매트릭스) | 260508 신규 | buy-member-access |
| 개인이용자 등록 | 기관정보 등록(관리자) | 등록 신청완료 | - | buy-member-companyRegistDone |
