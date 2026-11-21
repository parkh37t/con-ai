# 공급자포털 TO-BE IA (표 형식)

> AS-IS 1Depth 11개 골격(불변) + 매핑된 TO-BE 폴더 안 화면을 표 형식으로 정리.
> 깊이 라벨: L2(1Depth 직속) · L3(서브폴더) · L4(서브의 서브) · `└ 팝업`/`└ 모달`/`└ tab`(파일명 패턴).

## 1. 메인

▎ 폴더: `공급자포털/메인/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 입찰 상세 (계약접수) | `전체공고목록(가칭)/sell-bid-bidDetailOrderApplyTab.html` | `sell-bid-bidDetailOrderApplyTab` |
| L2 | 입찰 상세 (업체선정) | `전체공고목록(가칭)/sell-bid-bidDetailSelectionTab.html` | `sell-bid-bidDetailSelectionTab` |
| L2 | 계약접수 | `sell-contract-contractList.html` | `sell-contract-contractList` |
| L2 | 전체공고목록 | `sell-main-main.html` | `sell-main-main` |
| L2 | 검색결과 | `sell-main-search.html` | `sell-main-search` |
| L2 | 2인수의 안내공고 상세 (계약접수) | `전체공고목록(가칭)/sell-posting-postingDetailOrderApplyTab.html` | `sell-posting-postingDetailOrderApplyTab` |
| L2 | 2인수의 안내공고 상세 (업체선정) | `전체공고목록(가칭)/sell-posting-postingDetailSelectionTab.html` | `sell-posting-postingDetailSelectionTab` |
| └ 팝업 | 안내공고 상세조회 팝업 (공급업체) | `sell-posting-postingDetailPopup.html` | `sell-posting-postingDetailPopup` |
<!-- 260510-WAVE2-ATOMIC-SPLIT: 메인 quoteDetail composite 폐지 → 전체공고목록(가칭)의 atomic 사용 -->
| L2 | 1인수의 견적요청 상세 (계약접수) | `전체공고목록(가칭)/sell-quote-quoteDetailOrderApplyTab.html` | `sell-quote-quoteDetailOrderApplyTab` |
| L2 | 1인수의 견적요청 상세 (업체선정) | `전체공고목록(가칭)/sell-quote-quoteDetailSelectionTab.html` | `sell-quote-quoteDetailSelectionTab` |

---

## 2. 계약접수목록(공고목록)

▎ 폴더: `공급자포털/전체공고목록(가칭)/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 업체선정 | `sell-bid-bidDetailOrderApplyTab.html` | `sell-bid-bidDetailOrderApplyTab` |
| L2 | 업체선정(결과) | `sell-bid-bidDetailSelectionTab.html` | `sell-bid-bidDetailSelectionTab` |
| L2 | 업체선정 | `sell-posting-postingDetailOrderApplyTab.html` | `sell-posting-postingDetailOrderApplyTab` |
| L2 | 계약접수 | `sell-posting-postingDetailSelectionTab.html` | `sell-posting-postingDetailSelectionTab` |
| L2 | 업체선정 | `sell-quote-quoteDetailOrderApplyTab.html` | `sell-quote-quoteDetailOrderApplyTab` |
| L2 | 계약접수 | `sell-quote-quoteDetailSelectionTab.html` | `sell-quote-quoteDetailSelectionTab` |

---

## 3. 계약 공통

▎ 폴더: `공급자포털/연계정보/` + `공급자포털/입찰/`

### 3.1 연계정보/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 발주계획 목록 (S2B) | `sell-receipt-budgetS2BList.html` | `sell-receipt-budgetS2BList` |
| L2 | 발주계획 목록 (에듀파인) | `sell-receipt-budgetEdufineList.html` | `sell-receipt-budgetEdufineList` |
| L2 | 발주계획 목록 (G2B) | `sell-receipt-budgetG2BList.html` | `sell-receipt-budgetG2BList` |
| L2 | 상세 | `sell-receipt-budgetDetail.html` | `sell-receipt-budgetDetail` |
| L2 | 목록(에듀파인) | `sell-receipt-budgetEdufineList.html` | `sell-receipt-budgetEdufineList` |
| L2 | 목록(G2B) | `sell-receipt-budgetG2BList.html` | `sell-receipt-budgetG2BList` |
| L2 | 목록(S2B) | `sell-receipt-budgetS2BList.html` | `sell-receipt-budgetS2BList` |
| L2 | 사전규격 목록 (S2B) | `sell-receipt-prespecS2BList.html` | `sell-receipt-prespecS2BList` |
| L2 | 사전규격 목록 (에듀파인) | `sell-receipt-prespecEdufineList.html` | `sell-receipt-prespecEdufineList` |
| L2 | 사전규격 목록 (G2B) | `sell-receipt-prespecG2BList.html` | `sell-receipt-prespecG2BList` |
| L2 | 상세 | `sell-receipt-prespecDetail.html` | `sell-receipt-prespecDetail` |
| L2 | 목록(에듀파인) | `sell-receipt-prespecEdufineList.html` | `sell-receipt-prespecEdufineList` |
| L2 | 목록(G2B) | `sell-receipt-prespecG2BList.html` | `sell-receipt-prespecG2BList` |
| L2 | 목록(S2B) | `sell-receipt-prespecS2BList.html` | `sell-receipt-prespecS2BList` |
| L2 | 사전규격 공급업체 의견 상세 | `sell-receipt-prespecSellerOpinionDetail.html` | `sell-receipt-prespecSellerOpinionDetail` |

### 3.2 입찰/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 계약체결 탭 | `sell-mydesk-bid-bidDetailExecutionTab.html` | `sell-mydesk-bid-bidDetailExecutionTab` |
| L2 | 문서함 | `sell-mydesk-bid-bidDetailInboxDetail.html` | `sell-mydesk-bid-bidDetailInboxDetail` |
| L2 | 검수 탭 | `sell-mydesk-bid-bidDetailInspectionTab.html` | `sell-mydesk-bid-bidDetailInspectionTab` |
| L2 | 결제 탭 | `sell-mydesk-bid-bidPaymentTab.html` | `sell-mydesk-bid-bidPaymentTab` |

---

## 4. 리포팅/통계

▎ 폴더: `공급자포털/리포팅통계/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 수요기관 구매실적 조회 | `sell-report-sellerPurchased.html` | `sell-report-sellerPurchased` |
<!-- 260510-WAVE2-ATOMIC-SPLIT: composite topSeller_…_sellerPurchased 폐지 → atomic 4건 -->
| L2 | 공급업체 통계 (계약유형) | `sell-report-sellerServiceType.html` | `sell-report-sellerServiceType` |
| L2 | 공급업체 통계 (지역분포) | `sell-report-sellerRegion.html` | `sell-report-sellerRegion` |
| L2 | 공급업체 통계 (상위) | `sell-report-topSeller.html` | `sell-report-topSeller` |

---

## 5. 알림/커뮤니케이션

▎ 폴더: `공급자포털/알림커뮤니케이션/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 기획전 목록 | `sell-display-exhibitionList.html` | `sell-display-exhibitionList_기획전목록` |
| L2 | 커뮤니티 등록/수정 | `sell-notification-communityCreate.html` | `sell-notification-communityCreate` |
| L2 | 게시글 상세 | `sell-notification-communityDetail.html` | `sell-notification-communityDetail` |
| L2 | 커뮤니티 목록 | `sell-notification-communityList.html` | `sell-notification-communityList` |
| L2 | 참가 신청 | `sell-notification-eventApply.html` | `sell-notification-eventApply` |
| L2 | 상세 | `sell-notification-eventDetail.html` | `sell-notification-eventDetail` |
| L2 | 이벤트 목록 | `sell-notification-eventList.html` | `sell-notification-eventList` |
| L2 | 결과 조회 | `sell-notification-eventResult.html` | `sell-notification-eventResult` |
| L2 | 체험단 신청 | `sell-notification-testerApply.html` | `sell-notification-testerApply` |
| L2 | 체험단 상세 | `sell-notification-testerDetail.html` | `sell-notification-testerDetail` |
| L2 | 체험단 목록 | `sell-notification-testerList.html` | `sell-notification-testerList` |

---

## 6. 고객지원

▎ 폴더: `공급자포털/고객지원/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 고객센터안내 | `sell-support-ars.html` | `sell-support-ars` |
| └ 팝업 | ARS 상담 신청 팝업 | `sell-support-arsCreate-popup.html` | `sell-support-arsCreate-popup` |
| └ 팝업 | 1:1 문의하기 (풀오버레이) | `sell-support-askCreate-popup.html` | `sell-support-askCreate-popup` |
| L2 | S2B 이용 우수기관 (조달건수) | `sell-support-awardCount.html` | `sell-support-awardCount` |
| L2 | S2B 이용 우수기관 (조달금액) | `sell-support-awardAmount.html` | `sell-support-awardAmount` |
| L2 | 조달금액 | `sell-support-awardAmount.html` | `sell-support-awardAmount` |
| L2 | 조달건수 | `sell-support-awardCount.html` | `sell-support-awardCount` |
| L2 | S2B 안내 — BI | `sell-support-bi.html` | `sell-support-bi` |
| L2 | PR센터 브로슈어 | `sell-support-brochure.html` | `sell-support-brochure` |
| L2 | S2B경험행사 상세 | `sell-support-campaignDetail.html` | `sell-support-campaignDetail` |
| L2 | S2B경험행사 목록 | `sell-support-campaignList.html` | `sell-support-campaignList` |
| L2 | 지역센터 안내 | `sell-support-center.html` | `sell-support-center` |
| L2 | 인증서안내 | `sell-support-certificateInfo.html` | `sell-support-certificateInfo` |
| L2 | 통합 자료실 상세 | `sell-support-commonsHubDetail.html` | `sell-support-commonsHubDetail` |
| L2 | 목록 | `sell-support-commonsHubList.html` | `sell-support-commonsHubList` |
| L2 | 용어사전 | `sell-support-dictionary.html` | `sell-support-dictionary` |
| L2 | 자주 묻는 질문(FAQ) | `sell-support-faq.html` | `sell-support-faq` |
| L2 | 연혁 | `sell-support-history.html` | `sell-support-history` |
| L2 | 소개 | `sell-support-introduce.html` | `sell-support-introduce` |
| L2 | 법령 자료실 상세 | `sell-support-lawHubDetail.html` | `sell-support-lawHubDetail` |
| L2 | 법령 자료실 목록 | `sell-support-lawhubList.html` | `sell-support-lawhubList` |
| L2 | 로그인안내 | `sell-support-loginInfo.html` | `sell-support-loginInfo` |
| L2 | S2B주요행사 상세 | `sell-support-mainEventDetail.html` | `sell-support-mainEventDetail` |
| L2 | S2B주요행사 | `sell-support-mainEventList.html` | `sell-support-mainEventList` |
| L2 | 온라인매뉴얼 | `sell-support-manual.html` | `sell-support-manual` |
| L2 | 미디어 | `sell-support-media.html` | `sell-support-media` |
| L2 | 회원안내 | `sell-support-MembershipInfo.html` | `sell-support-MembershipInfo` |
| L2 | 모바일서비스 안내 | `sell-support-mobileService.html` | `sell-support-mobileService` |
| L2 | 뉴스룸 상세 | `sell-support-newsroomDetail.html` | `sell-support-newsroomDetail` |
| L2 | 뉴스룸 목록 | `sell-support-newsroomList.html` | `sell-support-newsroomList` |
| L2 | 상세 | `sell-support-noticeDetail.html` | `sell-support-noticeDetail` |
| L2 | 목록 | `sell-support-noticeList.html` | `sell-support-noticeList` |
| └ 팝업 | 텍스트 팝업 | `sell-support-noticeTextpopup.html` | `sell-support-noticeTextpopup` |
| L2 | 개인정보처리방침 | `sell-support-selfPrivacy.html` | `sell-support-selfPrivacy` |
| L2 | 시스템이용도우미 | `sell-support-systemHelp.html` | `sell-support-systemHelp` |
| L2 | 이용약관 | `sell-support-terms.html` | `sell-support-terms` |
| L2 | 교육연수 목록 (리스트) | `sell-support-trainingList.html` | `sell-support-trainingList` |
| L2 | 교육연수 목록 (캘린더) | `sell-support-trainingCalendar.html` | `sell-support-trainingCalendar` |
| L2 | 캘린더목록 | `sell-support-trainingCalendar.html` | `sell-support-trainingCalendar` |
| L2 | 상세 | `sell-support-trainingDetail.html` | `sell-support-trainingDetail` |
| L2 | 리스트목록 | `sell-support-trainingList.html` | `sell-support-trainingList` |
| L2 | 방문교육신청 | `sell-support-trainingVisitCreate.html` | `sell-support-trainingVisitCreate` |
| L2 | 체험단 안내 | `sell-support-trial.html` | `sell-support-trial` |

---

## 7. 로그인

▎ _(매핑되는 TO-BE 폴더 없음 — IA 정의 필요)_

---

## 8. 개인이용자

▎ 폴더: `공급자포털/회원가입/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 결제대행 이용약관 | `sell-member-agreePayment.html` | `sell-member-agreePayment` |
| L2 | 개인정보처리방침 (공급업체) | `sell-member-agreePrivacyPolicyConsent.html` | `sell-member-agreePrivacyPolicyConsent` |
| └ 팝업 | 이용약관 팝업 (공급업체) | `sell-member-agreePrivacyPolicyConsentpopup.html` | `sell-member-agreePrivacyPolicyConsentpopup` |
| L2 | 결제대행 이용약관 (공급업체) | `sell-member-agreeTermsOfUse.html` | `sell-member-agreeTerms` |
| L2 | 수수료 안내(공급) | `sell-member-charge.html` | `sell-member-charge` |
| L2 | sell-member-companyRegistCreate_공급업체조회게이트 | `sell-member-companyRegistCreate_공급업체조회게이트.html` | `sell-member-companyRegistCreate_공급업체조회게이트` |
| └ 팝업 | sell-member-companyRegistInfo_공급업체등록팝업 | `sell-member-companyRegistInfo_공급업체등록팝업.html` | `sell-member-companyRegistInfo_공급업체등록팝업` |
| L2 | 이용자 추가 팝업 | `sell-member-groupAddMember.html` | `sell-member-groupAddMember` |
| └ 팝업 | 주력제품조회 팝업 | `sell-member-industryCorePopup.html` | `sell-member-industryCorePopup` |
| └ 팝업 | 업종조회 팝업 | `sell-member-industryPopup.html` | `sell-member-industryPopup` |
| L2 | 인증서 등록 (공급업체) | `sell-member-inquiryso.html` | `sell-member-inquiryso` |
| └ 팝업 | 제조사정보조회 팝업 | `sell-member-manufacturingPopup.html` | `sell-member-manufacturingPopup` |
| L2 | 이용자 승인 팝업 | `sell-member-memberApprove.html` | `sell-member-memberApprove` |
| L2 | 그룹 상세 | `sell-member-memberDetail.html` | `sell-member-memberDetail` |
| L2 | 그룹 목록 | `sell-member-memberList.html` | `sell-member-memberList` |
| L2 | 이용자 반려 팝업 | `sell-member-memberReject.html` | `sell-member-memberReject` |
| L2 | 신규 비밀번호 입력 | `sell-member-newPassword.html` | `sell-member-newPassword` |
| L2 | 비밀번호 재설정 | `sell-member-resetPassword.html` | `sell-member-resetPassword` |
| L2 | S2B이용기관 조회 팝업 | `sell-member-searchCompanyId.html` | `sell-member-searchCompanyId` |
| L2 | 행정표준기관 조회 팝업 | `sell-member-searchGovernmentCode.html` | `sell-member-searchGovernmentCode` |
| L2 | 아이디 찾기 | `sell-member-searchId.html` | `sell-member-searchId` |
| L2 | 아이디 찾기 결과 (공급업체) | `sell-member-searchIdResult.html` | `sell-member-searchIdResult` |
| L2 | 이용자 조회 팝업 | `sell-member-searchMember.html` | `sell-member-searchMember` |
| L2 | 공급업체 회원가입 | `sell-member-signup_공급업체회원가입.html` | `sell-member-signup_공급업체회원가입` |

---

## 9. 업체정보관리

▎ 폴더: `공급자포털/이용자관리/` + `공급자포털/견적정보관리/` + `공급자포털/미니샵관리/`

### 9.1 이용자관리/

#### 9.1.1 공급업체가입/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | STEP2 공급업체 인증서 등록 | `sell-member-injeungseo.html` | `sell-member-injeungseo` |
| L3 | 공급업체 신규등록 | `sell-member-application.html` | `sell-member-application` |
| L3 | STEP1 기본정보 등록 | `sell-member-governmentCodeCreate.html` | `sell-member-governmentCodeCreate` |
| L3 | STEP2 업종정보 등록 | `sell-member-industry.html` | `sell-member-industry` |
| L3 | STEP6 생산정보 등록 | `sell-member-Manufacturing_STEP6_생산정보등록.html` | `sell-member-Manufacturing_STEP6_생산정보등록` |
| L3 | STEP3 인증정보 등록 | `sell-member-Recognition_STEP3_인증정보등록.html` | `sell-member-Recognition_STEP3_인증정보등록` |
| L3 | 약관동의 | `sell-member-sellTermsAgreement_약관동의.html` | `sell-member-sellTermsAgreement_약관동의` |
| └ 팝업 | 선택약관 보기 | `sell-member-sellTermsPopup_약관보기.html` | `sell-member-sellTermsPopup_약관보기` |
| └ 팝업 | 공급업체 등록안내 자동팝업 | `SUP-H-UM-0101_공급업체등록안내팝업.html` | `SUP-H-UM-0101_공급업체등록안내팝업` |

#### 9.1.2 권한그룹/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 권한그룹 등록 | `sell-member-groupCreate_권한그룹등록.html` | `sell-member-groupCreate_권한그룹등록` |
| L3 | 권한그룹 상세 | `sell-member-groupDetail_권한그룹상세.html` | `sell-member-groupDetail_권한그룹상세` |
| L3 | 권한그룹 목록 | `sell-member-groupList_권한그룹목록.html` | `sell-member-groupList_권한그룹목록` |

#### 9.1.3 이용자목록/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 이용자 관리 목록 | `sell-member-companionlist_다건선택승인.html` | `sell-member-companionlist_다건선택승인` |
| L3 | 이용자 소속삭제 팝업 | `sell-member-memberCompanyDelete.html` | `sell-member-memberCompanyDelete` |

#### 9.1.4 정보수정/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공급업체정보 수정 | `sell-member-govermentCodeEdit_기본정보수정.html` | `sell-member-govermentCodeEdit_기본정보수정` |
| L3 | 제조사정보 수정 | `sell-member-manufacturingEdit.html` | `sell-member-manufacturingEdit` |

#### 9.1.5 탈퇴해지/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공급업체 등록해지 | `sell-mydesk-member-Leavee_공급업체등록해지.html` | `sell-mydesk-member-Leavee_공급업체등록해지` |
| L3 | 공급업체 등록해지 완료 | `sell-mydesk-member-Leaveeclear_등록해지완료.html` | `sell-mydesk-member-Leaveeclear_등록해지완료` |
| L3 | 소속탈퇴 완료 | `sell-mydesk-member-Withdrawalclear_소속탈퇴완료.html` | `sell-mydesk-member-Withdrawalclear_소속탈퇴완료` |

#### 9.1.6 회원가입/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공급업체 회원가입 약관동의 | `sell-member-agree_회원가입약관동의.html` | `sell-member-agree_회원가입약관동의` |
| L3 | 회원가입 완료 | `sell-member-joined.html` | `sell-member-joined` |
| └ 팝업 | 공급업체 선택 팝업 | `sell-member-searchCompanyId_공급업체선택팝업.html` | `sell-member-searchCompanyId_공급업체선택팝업` |
| L3 | 아이디 찾기 | `sell-member-searchId_아이디찾기.html` | `sell-member-searchId_아이디찾기` |
| L3 | 아이디찾기 | `sell-member-serchIDResult_아이디찾기결과.html` | `sell-member-serchIDResult_아이디찾기결과` |
| L3 | 기본정보 입력 | `sell-member-profileCreate.html` | `sell-member-profileCreate` |

### 9.2 견적정보관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 견적정보 상세 | `sell-catalog-catalogDetail.html` | `sell-catalog-catalogDetail` |
| L2 | 견적 오류 신고 상세 | `sell-catalog-catalogErrorDetail.html` | `sell-catalog-catalogErrorDetail` |
| L2 | 견적오류신고 목록 | `sell-catalog-catalogErrorList.html` | `sell-catalog-catalogErrorList` |
| L2 | 견적정보 목록 | `sell-catalog-catalogList.html` | `sell-catalog-catalogList` |

### 9.3 미니샵관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 미니샵 기본설정 | `sell-mydesk-miniShopBasicTab.html` | `sell-mydesk-miniShopBasicTab` |
| L2 | 미니샵 전시 관리 | `sell-mydesk-miniShopDisplayManageTab.html` | `sell-mydesk-miniShopDisplayManageTab` |
| L2 | 견적정보 검색/선택 | `sell-notification-miniShopDisplayPopup.html` | `sell-notification-miniShopDisplayPopup` |
| L2 | 미니샵 공지사항 관리 | `sell-mydesk-miniShopNoticeManageTab.html` | `sell-mydesk-miniShopNoticeManageTab` |
| L2 | 미니샵 견적문의 조회 | `sell-mydesk-miniShopQuestionTab.html` | `sell-mydesk-miniShopQuestionTab` |

---

## 10. 마이데스크

▎ 폴더: `공급자포털/마이데스크/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 개인이용자 탈퇴 | `S2B-SUP-MYPAGE-002_개인이용자탈퇴.html` | `S2B-SUP-MYPAGE-002_개인이용자탈퇴` |
| L2 | 계약접수 | `sell-mydesk-bid-bidDetailOrderApplyTab.html` | `sell-mydesk-bid-bidDetailOrderApplyTab` |
| L2 | 업체선정 | `sell-mydesk-bid-bidDetailSelectionTab.html` | `sell-mydesk-bid-bidDetailSelectionTab` |
| L2 | 계약진행 탭 | `sell-mydesk-catalog-catalogDetailExecutionTab.html` | `sell-mydesk-catalog-catalogDetailExecutionTab` |
| L2 | 문서함 탭 | `sell-mydesk-catalog-catalogDetailInboxTab.html` | `sell-mydesk-catalog-catalogDetailInboxTab` |
| L2 | 검수 탭 | `sell-mydesk-catalog-catalogDetailInspectionTab.html` | `sell-mydesk-catalog-catalogDetailInspectionTab` |
| L2 | 결제 탭 | `sell-mydesk-catalog-catalogDetailPaymentTab.html` | `sell-mydesk-catalog-catalogDetailPaymentTab` |
| L2 | 업체선정 탭 | `sell-mydesk-catalog-catalogDetailSelectionTab.html` | `sell-mydesk-catalog-catalogDetailSelectionTab` |
| L2 | 계약체결 탭 | `sell-mydesk-posting-postingDetailExecutionTab.html` | `sell-mydesk-posting-postingDetailExecutionTab` |
| L2 | 문서함 탭 | `sell-mydesk-posting-postingDetailInboxTab.html` | `sell-mydesk-posting-postingDetailInboxTab` |
| L2 | 검수 탭 | `sell-mydesk-posting-postingDetailInspectionTab.html` | `sell-mydesk-posting-postingDetailInspectionTab` |
| L2 | 계약접수 | `sell-mydesk-posting-postingDetailOrderApplyTab.html` | `sell-mydesk-posting-postingDetailOrderApplyTab` |
| L2 | 결제 탭 | `sell-mydesk-posting-postingDetailPaymentTab.html` | `sell-mydesk-posting-postingDetailPaymentTab` |
| L2 | 업체선정 | `sell-mydesk-posting-postingDetailSelectionTab.html` | `sell-mydesk-posting-postingDetailSelectionTab` |
| L2 | 계약진행 | `sell-mydesk-quote-quoteDetailExecutionTab.html` | `sell-mydesk-quote-quoteDetailExecutionTab` |
| L2 | 검수 | `sell-mydesk-quote-quoteDetailInspectionTab.html` | `sell-mydesk-quote-quoteDetailInspectionTab` |
| L2 | 계약접수 | `sell-mydesk-quote-quoteDetailOrderApplyTab.html` | `sell-mydesk-quote-quoteDetailOrderApplyTab` |
| L2 | 결제 | `sell-mydesk-quote-quoteDetailPaymentTab.html` | `sell-mydesk-quote-quoteDetailPaymentTab` |
| L2 | 업체선정 | `sell-mydesk-quote-quoteDetailSelectionTab.html` | `sell-mydesk-quote-quoteDetailSelectionTab` |

#### 10.1 1인수의견적요청/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
<!-- 260510-WAVE2-ATOMIC-SPLIT: 견적요청 상세 6탭 composite 폐지 → atomic 6건 -->
| L3 | 견적요청 상세 — 계약요청 | `../sell-mydesk-quote-quoteDetailOrderApplyTab.html` | `sell-mydesk-quote-quoteDetailOrderApplyTab` |
| L3 | 견적요청 상세 — 계약접수 | `../sell-mydesk-quote-quoteDetailSelectionTab.html` | `sell-mydesk-quote-quoteDetailSelectionTab` |
| L3 | 견적요청 상세 — 계약진행 | `../sell-mydesk-quote-quoteDetailExecutionTab.html` | `sell-mydesk-quote-quoteDetailExecutionTab` |
| L3 | 견적요청 상세 — 검수 | `../sell-mydesk-quote-quoteDetailInspectionTab.html` | `sell-mydesk-quote-quoteDetailInspectionTab` |
| L3 | 견적요청 상세 — 결제 | `../sell-mydesk-quote-quoteDetailPaymentTab.html` | `sell-mydesk-quote-quoteDetailPaymentTab` |
| L3 | 견적요청 상세 — 문서함 | `../sell-mydesk-quote-quoteDetailInboxDetail.html` | `sell-mydesk-quote-quoteDetailInboxDetail` |
| └ 팝업 | 상세조회 팝업 | `sell-quote-quoteDetailPopup.html` | `sell-quote-quoteDetailPopup` |

#### 10.2 1인수의견적정보/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 주소 조회 팝업 | `sell-mydesk-catalog-AddressViewPopup.html` | `sell-mydesk-catalog-AddressViewPopup` |
| L3 | 견적정보 -- 승인요청 등록 | `sell-mydesk-catalog-approvalRequestCreate.html` | `sell-mydesk-catalog-approvalRequestCreate` |
| L3 | 승인요청 상세 | `sell-mydesk-catalog-approvalRequestDetail.html` | `sell-mydesk-catalog-approvalRequestDetail` |
| L3 | 승인요청 목록 | `sell-mydesk-catalog-approvalRequestList.html` | `sell-mydesk-catalog-approvalRequestList` |
| └ 팝업 | 도서 조회 팝업 | `sell-mydesk-catalog-catalogBookSearch.html` | `sell-mydesk-catalog-catalogBookSearch` |
| └ 팝업 | 제재안내 팝업 (catalogCreate 진입시) | `sell-mydesk-catalog-CreateInfoPopup.html` | `sell-mydesk-catalog-CreateInfoPopup` |
| └ 팝업 | 브랜드 조회 팝업 (탭1) | `sell-mydesk-catalog-brandSearchPopup.html` | `sell-mydesk-catalog-brandSearchPopup` |
| └ 팝업 | 브랜드 등록요청 팝업 (탭2) | `sell-mydesk-catalog-brandRegiRequestPopup.html` | `sell-mydesk-catalog-brandRegiRequestPopup` |
| └ 팝업 | 제조사 등록요청 팝업 (탭2) | `sell-mydesk-catalog-ManufacRegiRequestPopup.html` | `sell-mydesk-catalog-ManufacRegiRequestPopup` |
| L3 | 일괄등록 | `sell-mydesk-catalog-Bulkregist.html` | `sell-mydesk-catalog-Bulkregist` |
| L3 | 일괄등록 이력 | `sell-mydesk-catalog-BulkregistHistory.html` | `sell-mydesk-catalog-BulkregistHistory` |
| L3 | 물품분류체계 조회 | `sell-mydesk-catalog-catalogCategorySearch.html` | `sell-mydesk-catalog-catalogCategorySearch` |
| L3 | 견적등록 | `sell-mydesk-catalog-catalogCreate.html` | `sell-mydesk-catalog-catalogCreate` |
| L3 | 1인수의 견적정보 상세 (계약접수) | `../sell-mydesk-catalog-catalogDetailSelectionTab.html` | `sell-mydesk-catalog-catalogDetailSelectionTab` |
| L3 | 1인수의 견적정보 상세 (계약진행) | `../sell-mydesk-catalog-catalogDetailExecutionTab.html` | `sell-mydesk-catalog-catalogDetailExecutionTab` |
| L3 | 1인수의 견적정보 상세 (검수) | `../sell-mydesk-catalog-catalogDetailInspectionTab.html` | `sell-mydesk-catalog-catalogDetailInspectionTab` |
| L3 | 1인수의 견적정보 상세 (결제) | `../sell-mydesk-catalog-catalogDetailPaymentTab.html` | `sell-mydesk-catalog-catalogDetailPaymentTab` |
| L3 | 1인수의 견적정보 상세 (문서함) | `../sell-mydesk-catalog-catalogDetailInboxTab.html` | `sell-mydesk-catalog-catalogDetailInboxTab` |
| L3 | 견적정보 상세 | `sell-mydesk-catalog-catalogDetail.html` | `sell-mydesk-catalog-catalogDetail` |
| L3 | 견적정보 목록 | `sell-mydesk-catalog-catalogList.html` | `sell-mydesk-catalog-catalogList` |
| └ 팝업 | 판매상태 일괄 변경 | `sell-mydesk-catalog-CostinfoPopup.html` | `sell-mydesk-catalog-CostinfoPopup` |
| └ 팝업 | 당일 배송 팝업 | `sell-mydesk-catalog-DayShippingViewPopup.html` | `sell-mydesk-catalog-DayShippingViewPopup` |
| └ 팝업 | 업로드 | `sell-mydesk-catalog-ExceluploadPopup.html` | `sell-mydesk-catalog-ExceluploadPopup` |
| └ 팝업 | G2B 직접 조회 팝업 | `sell-mydesk-catalog-G2BViewPopup.html` | `sell-mydesk-catalog-G2BViewPopup` |
| L3 | 이미지 관리 상세 | `sell-mydesk-catalog-ImageDetail.html` | `sell-mydesk-catalog-ImageDetail` |
| L3 | 이미지 관리 | `sell-mydesk-catalog-Imagelist.html` | `sell-mydesk-catalog-Imagelist` |
| L3 | 이미지 관리 등록 | `sell-mydesk-catalog-ImageRegist.html` | `sell-mydesk-catalog-ImageRegist` |
| └ 팝업 | 업로드 | `sell-mydesk-catalog-ImageuploadPopup.html` | `sell-mydesk-catalog-ImageuploadPopup` |
| └ 팝업 | 이미지 | `sell-mydesk-catalog-ImageViewPopup.html` | `sell-mydesk-catalog-ImageViewPopup` |
| └ 팝업 | 제조사 조회 팝업 | `sell-mydesk-catalog-ManufacViewPopup.html` | `sell-mydesk-catalog-ManufacViewPopup` |
| L3 | 승인요청 | `sell-mydesk-catalog-requestList.html` | `sell-mydesk-catalog-requestList` |
| L3 | 견적정보 -- 판매 등록 | `sell-mydesk-catalog-saleCreate.html` | `sell-mydesk-catalog-saleCreate` |
| L3 | 판매 상세 | `sell-mydesk-catalog-saleDetail.html` | `sell-mydesk-catalog-saleDetail` |
| L3 | 판매 목록 | `sell-mydesk-catalog-saleList.html` | `sell-mydesk-catalog-saleList` |
| L3 | 판매용 검수조회 | `sell-mydesk-catalog-salesStatusList.html` | `sell-mydesk-catalog-salesStatusList` |
| └ 팝업 | 배송정보 템플릿 팝업 | `sell-mydesk-catalog-ShippingInfoTemplatePopup.html` | `sell-mydesk-catalog-ShippingInfoTemplatePopup` |
| L3 | 임시저장 | `sell-mydesk-catalog-tempcatalogList.html` | `sell-mydesk-catalog-tempcatalogList` |
| L3 | 견적정보 -- 임시저장 등록 | `sell-mydesk-catalog-tempSaveCreate.html` | `sell-mydesk-catalog-tempSaveCreate` |
| L3 | 이어작성 | `sell-mydesk-catalog-tempSaveDetail.html` | `sell-mydesk-catalog-tempSaveDetail` |
| L3 | 임시저장 목록 | `sell-mydesk-catalog-tempSaveList.html` | `sell-mydesk-catalog-tempSaveList` |

#### 10.3 2인수의안내공고/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
<!-- 260510-WAVE2-ATOMIC-SPLIT: 안내공고 상세 6탭 composite 폐지 → atomic 6건은 마이데스크 폴더에 존재 -->
| L3 | 안내공고 상세 — 계약요청 | `../sell-mydesk-posting-postingDetailOrderApplyTab.html` | `sell-mydesk-posting-postingDetailOrderApplyTab` |
| L3 | 안내공고 상세 — 계약접수 | `../sell-mydesk-posting-postingDetailSelectionTab.html` | `sell-mydesk-posting-postingDetailSelectionTab` |
| L3 | 안내공고 상세 — 계약진행 | `../sell-mydesk-posting-postingDetailExecutionTab.html` | `sell-mydesk-posting-postingDetailExecutionTab` |
| L3 | 안내공고 상세 — 검수 | `../sell-mydesk-posting-postingDetailInspectionTab.html` | `sell-mydesk-posting-postingDetailInspectionTab` |
| L3 | 안내공고 상세 — 결제 | `../sell-mydesk-posting-postingDetailPaymentTab.html` | `sell-mydesk-posting-postingDetailPaymentTab` |
| L3 | 안내공고 상세 — 문서함 | `../sell-mydesk-posting-postingDetailInboxTab.html` | `sell-mydesk-posting-postingDetailInboxTab` |
| └ 팝업 | 상세조회 팝업 | `sell-mydesk-posting-postingDetailPopup.html` | `sell-mydesk-posting-postingDetailPopup` |

#### 10.4 검수관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약이행 신뢰도 조회 | `sell-mydesk-inspection-buyerReliability.html` | `sell-mydesk-inspection-buyerReliability` |
| L3 | 검수요청 상세 | `sell-mydesk-inspection-deliveryRequestDetail.html` | `sell-mydesk-inspection-deliveryRequestDetail` |
| └ 팝업 | 배송조회 팝업 | `sell-mydesk-inspection-deliverySearchPopup.html` | `sell-mydesk-inspection-deliverySearchPopup` |
| L3 | 업체 만족도 평가 | `sell-mydesk-inspection-GoodsReview.html` | `sell-mydesk-inspection-GoodsReview` |
| L3 | 조치불가의견 등록 | `sell-mydesk-inspection-inspectionAdjustmentRequest.html` | `sell-mydesk-inspection-inspectionAdjustmentRequest` |
| L3 | 검수요청 등록 | `sell-mydesk-inspection-inspectionRequestCreate.html` | `sell-mydesk-inspection-inspectionRequestCreate` |
| L3 | 검수요청 상세 | `sell-mydesk-inspection-inspectionRequestDetail.html` | `sell-mydesk-inspection-inspectionRequestDetail` |
| L3 | 서비스상세 검수 탭 | `sell-mydesk-inspection-inspectionTab.html` | `sell-mydesk-inspection-inspectionTab` |
| L3 | 검수 알림 상세 | `sell-mydesk-inspection-notificationDetail.html` | `sell-mydesk-inspection-notificationDetail` |
| L3 | 알림함 목록 | `sell-mydesk-inspection-notificationList.html` | `sell-mydesk-inspection-notificationList` |
| L3 | 검수 알림 설정 | `sell-mydesk-inspection-notificationSetting.html` | `sell-mydesk-inspection-notificationSetting` |
| ~~L3~~ | ~~재검수요청 등록~~ ⚠ 폐지(260512 회의 — `inspectionRequestCreate.html`에 재요청 모드로 통합) | `sell-mydesk-inspection-reinspectionRequestCreate.html` (placeholder) | `sell-mydesk-inspection-reinspectionRequestCreate` |
| L3 | 이용후기 확인 팝업 | `sell-mydesk-inspection-reviewDetail.html` | `sell-mydesk-inspection-reviewDetail` |
| L3 | 이용후기 조회 | `sell-mydesk-inspection-reviewList.html` | `sell-mydesk-inspection-reviewList` |
| L3 | 업체 만족도 조회 | `sell-mydesk-inspection-SellerReview.html` | `sell-mydesk-inspection-SellerReview` |
| ~~L3~~ | ~~검수요청 취소 승인/반려~~ ⚠ 폐지(260512 회의 — 미검수해제·검수판정취소 흐름 폐지) | `sell-mydesk-inspection-uninspectRequestReject.html` (placeholder) | `sell-mydesk-inspection-uninspectRequestReject` |

#### 10.5 결제관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 잔금 신청서 등록 | `sell-mydesk-payment-balanceCreate.html` | `sell-mydesk-payment-balanceCreate` |
| └ 팝업 | 잔금신청이력 상세 | `sell-mydesk-payment-balanceDetailPopup.html` | `sell-mydesk-payment-balanceDetailPopup` |
| L3 | 잔금 신청서 수정 | `sell-mydesk-payment-balanceUpdate.html` | `sell-mydesk-payment-balanceUpdate` |
| L3 | 이용수수료 납부현황 | `sell-mydesk-payment-cardDepositList.html` | `sell-mydesk-payment-cardDepositList` |
| L3 | 카드 결제 목록 | `sell-mydesk-payment-cardPaymentList.html` | `sell-mydesk-payment-cardPaymentList` |
| L3 | 카드 결제 설정 | `sell-mydesk-payment-cardPaymentSet.html` | `sell-mydesk-payment-cardPaymentSet` |
| L3 | 일괄지급 신청이력 상세 | `sell-mydesk-payment-paymentDetail.html` | `sell-mydesk-payment-paymentDetail` |
| L3 | 선금신청서 등록 | `sell-mydesk-payment-prepayCreate.html` | `sell-mydesk-payment-prepayCreate` |
| └ 팝업 | 선금신청서 상세 | `sell-mydesk-payment-prepayDetailPopup.html` | `sell-mydesk-payment-prepayDetailPopup` |
| L3 | 선금 신청 리포트 1 | `sell-mydesk-payment-prepayReport01.html` | `sell-mydesk-payment-prepayReport01` |
| L3 | 선금 신청 리포트 2 | `sell-mydesk-payment-prepayReport02.html` | `sell-mydesk-payment-prepayReport02` |
| L3 | 선금신청서 수정 | `sell-mydesk-payment-prepayUpdate.html` | `sell-mydesk-payment-prepayUpdate` |
| L3 | 기성금 신청서 등록 | `sell-mydesk-payment-progressCreate.html` | `sell-mydesk-payment-progressCreate` |
| └ 팝업 | 기성금 신청서 상세 | `sell-mydesk-payment-progressDetailPopup.html` | `sell-mydesk-payment-progressDetailPopup` |
| L3 | 기성금 신청서 수정 | `sell-mydesk-payment-progressUpdate.html` | `sell-mydesk-payment-progressUpdate` |
| └ 팝업 | 결제 반려 검토 | `sell-mydesk-payment-rejectCheckPopup.html` | `sell-mydesk-payment-rejectCheckPopup` |

#### 10.6 계약공통업무/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약서 검토 | `sell-mydesk-execution-draftCheck.html` | `sell-mydesk-execution-draftCheck` |
| L3 | 계약 해제/해지 요청 | `sell-mydesk-execution-draftRelease.html` | `sell-mydesk-execution-draftRelease` |
| L3 | 계약 해제/해지 검토 | `sell-mydesk-execution-draftReleaseCheck.html` | `sell-mydesk-execution-draftReleaseCheck` |
| L3 | 계약 이행 포기 | `sell-mydesk-execution-Giveup.html` | `sell-mydesk-execution-Giveup` |
| L3 | 변경계약서 검토 | `sell-mydesk-execution-updateDraftCheck.html` | `sell-mydesk-execution-updateDraftCheck` |

#### 10.7 관심공고계약현황/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공공구매 실적 등록 | `sell-mydesk-contract-publicsellCreate.html` | `sell-mydesk-contract-publicsellCreate` |
| L3 | 공공구매 실적 상세 | `sell-mydesk-contract-publicsellDetail.html` | `sell-mydesk-contract-publicsellDetail` |
| L3 | 공공구매 실적 목록 | `sell-mydesk-contract-publicsellList.html` | `sell-mydesk-contract-publicsellList` |
| L3 | 관심상품 상세 | `sell-mydesk-contract-wishCatalogDetail.html` | `sell-mydesk-contract-wishCatalogDetail` |
| L3 | 관심상품 목록 | `sell-mydesk-contract-wishCatalogList.html` | `sell-mydesk-contract-wishCatalogList` |
| L3 | 관심공고 등록 | `sell-mydesk-contract-wishlistCreate.html` | `sell-mydesk-contract-wishlistCreate` |
| L3 | 관심공고 삭제 | `sell-mydesk-contract-wishlistDelete.html` | `sell-mydesk-contract-wishlistDelete` |
| L3 | 목록 | `sell-mydesk-contract-wishlistSetting.html` | `sell-mydesk-contract-wishlistSetting` |
| L3 | 관심공고 수정 | `sell-mydesk-contract-wishlistUpdate.html` | `sell-mydesk-contract-wishlistUpdate` |

#### 10.8 교육고객지원/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 등록/수정 | `sell-mydesk-support-askCreate.html` | `sell-mydesk-support-askCreate` |
| L3 | 상세 | `sell-mydesk-support-askDetail.html` | `sell-mydesk-support-askDetail` |
| L3 | 목록 | `sell-mydesk-support-askList.html` | `sell-mydesk-support-askList` |
| L3 | 커뮤니티 활동 (내 글·좋아요·스크랩) | `sell-mydesk-support-communityList.html` | `sell-mydesk-support-communityList` |
| L3 | 교육연수 상세 | `sell-mydesk-support-trainingDetail.html` | `sell-mydesk-support-trainingDetail` |
| L3 | 교육연수 목록 | `sell-mydesk-support-trainingList.html` | `sell-mydesk-support-trainingList` |
| L3 | 방문교육 상세 | `sell-mydesk-support-trainingOfflineDetail.html` | `sell-mydesk-support-trainingOfflineDetail` |
| L3 | 방문교육 목록 | `sell-mydesk-support-trainingOfflineList.html` | `sell-mydesk-support-trainingOfflineList` |

#### 10.9 납품불합격관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 납품 불합격 정보 수정/삭제 | `sell-inspection-rejectionDelete.html` | `sell-inspection-rejectionDelete` |
| L3 | 납품 불합격 정보 등록·상세 | `sell-inspection-rejectionDetail.html` | `sell-inspection-rejectionDetail` |
| L3 | 납품 불합격 목록 | `sell-inspection-rejectionList.html` | `sell-inspection-rejectionList` |

#### 10.10 대시보드리포팅/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약목록 | `sell-mydesk-report-contractList.html` | `sell-mydesk-report-contractList` |
| L3 | 대시보드 | `sell-mydesk-report-dashboard.html` | `sell-mydesk-report-dashboard` |

#### 10.11 알림함/ (폐지)

체험단 기능이 커뮤니티로 통합되면서 마이데스크 알림함의 체험단 화면 4종(testerApply·testerDetail·testerList·testerReviewCreate)은 폐지되었다. 본인 활동 내역은 교육고객지원/ 의 [커뮤니티 활동](`sell-mydesk-support-communityList`)에서 확인한다.

#### 10.12 업체선정수의시담/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 견적정보 | `sell-mydesk-selection-catalogNegoApply.html` | `sell-mydesk-selection-catalogNegoApply` |
| L3 | 견적정보 | `sell-mydesk-selection-catalogNegoDetail.html` | `sell-mydesk-selection-catalogNegoDetail` |
| L3 | 수의시담 목록 | `sell-mydesk-selection-negoList.html` | `sell-mydesk-selection-negoList` |
| L3 | 견적요청 | `sell-mydesk-selection-quoteNegoApply.html` | `sell-mydesk-selection-quoteNegoApply` |
| L3 | 견적요청 | `sell-mydesk-selection-quoteNegoDetail.html` | `sell-mydesk-selection-quoteNegoDetail` |

#### 10.13 연계정보관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약서 작성 (입찰) | `sell-mydesk-receipt-bidDraftCreate.html` | `sell-mydesk-receipt-bidDraftCreate` |
| L3 | 입찰공고 인쇄 | `sell-mydesk-receipt-bidNoticeSamplePrint.html` | `sell-mydesk-receipt-bidNoticeSamplePrint` |
| L3 | 계약서 작성 (안내공고) | `sell-mydesk-receipt-postingDraftCreate.html` | `sell-mydesk-receipt-postingDraftCreate` |
| L3 | 안내공고 인쇄 (공급업체) | `sell-mydesk-receipt-postingNoticeSamplePrint.html` | `sell-mydesk-receipt-postingNoticeSamplePrint` |
| L3 | 계약서 작성 (견적요청) | `sell-mydesk-receipt-quoteDraftCreate.html` | `sell-mydesk-receipt-quoteDraftCreate` |

#### 10.14 이용자그룹관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 로그인 | `sell-mydesk-member-loginPopup.html` | `sell-mydesk-member-loginPopup` |
| L3 | 미니샵 공지사항 → sell-mydesk-miniShopNoticeManageTab 통합 이전 | `sell-mydesk-member-minishopNoticeList.html` | `sell-mydesk-member-minishopNoticeList` |
| L3 | 미니샵 프로모션 → sell-mydesk-miniShopDisplayManageTab 통합 이전 | `sell-mydesk-member-minishopPromotionList.html` | `sell-mydesk-member-minishopPromotionList` |
| L3 | 미니샵 기본설정 → sell-mydesk-miniShopBasicTab 통합 이전 | `sell-mydesk-member-minishopSetting.html` | `sell-mydesk-member-minishopSetting` |
| L3 | 회원정보수정 | `sell-mydesk-member-profileUpdate.html` | `sell-mydesk-member-profileUpdate` |
| L3 | 소속업체탈퇴 | `sell-mydesk-member-Withdrawal.html` | `sell-mydesk-member-Withdrawal` |

#### 10.15 입찰/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
<!-- 260510-WAVE2-ATOMIC-SPLIT: 입찰 상세 6탭 composite 폐지 → atomic 6건은 마이데스크/입찰 폴더에 존재 -->
| L3 | 입찰 상세 — 계약요청 | `../sell-mydesk-bid-bidDetailOrderApplyTab.html` | `sell-mydesk-bid-bidDetailOrderApplyTab` |
| L3 | 입찰 상세 — 계약접수 | `../sell-mydesk-bid-bidDetailSelectionTab.html` | `sell-mydesk-bid-bidDetailSelectionTab` |
| L3 | 입찰 상세 — 계약진행 | `sell-mydesk-bid-bidDetailExecutionTab.html` | `sell-mydesk-bid-bidDetailExecutionTab` |
| L3 | 입찰 상세 — 검수 | `sell-mydesk-bid-bidDetailInspectionTab.html` | `sell-mydesk-bid-bidDetailInspectionTab` |
| L3 | 입찰 상세 — 결제 | `sell-mydesk-bid-bidPaymentTab.html` | `sell-mydesk-bid-bidPaymentTab` |
| L3 | 입찰 상세 — 문서함 | `sell-mydesk-bid-bidDetailInboxDetail.html` | `sell-mydesk-bid-bidDetailInboxDetail` |
| └ 팝업 | 입찰 상세 조회 팝업 | `sell-mydesk-bid-bidDetailPopup.html` | `sell-mydesk-bid-bidDetailPopup` |

#### 10.16 정산관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 이용수수료 환불 목록 | `sell-mydesk-settlement-feeRefundList.html` | `sell-mydesk-settlement-feeRefundList` |
| L3 | 이용수수료 환불/면제 신청 목록 | `sell-mydesk-settlement-payFeeList.html` | `sell-mydesk-settlement-payFeeList` |
| L3 | 이용수수료 환불/면제 신청서 작성 | `sell-mydesk-settlement-payFeeReqDetail.html` | `sell-mydesk-settlement-payFeeReqDetail` |
| L3 | 이용수수료 선불 요청 목록 | `sell-mydesk-settlement-payFeeReqList.html` | `sell-mydesk-settlement-payFeeReqList` |
| └ 팝업 | 공급업체 | `sell-mydesk-settlement-payFeeReqPopup.html` | `sell-mydesk-settlement-payFeeReqPopup` |
| L3 | 일괄지급 신청서 등록 | `sell-mydesk-payment-paymentCreate.html` | `sell-mydesk-payment-paymentCreate` |
| L3 | 일괄지급 신청서 수정 | `sell-mydesk-payment-paymentUpdate.html` | `sell-mydesk-payment-paymentUpdate` |
| L3 | 지역분포 | `sell-report-sellerRegion.html` | `sell-report-sellerRegion` |
| L3 | 계약유형 | `sell-report-sellerServiceType.html` | `sell-report-sellerServiceType` |

#### 10.17 클린거래제보센터/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 등록 | `sell-mydesk-cleandeal-catalogmonitoring-create.html` | `sell-mydesk-cleandeal-catalogmonitoring-create` |
| L3 | 상세 | `sell-mydesk-cleandeal-catalogmonitoring-detail.html` | `sell-mydesk-cleandeal-catalogmonitoring-detail` |
| L3 | 목록 | `sell-mydesk-cleandeal-catalogmonitoring-list.html` | `sell-mydesk-cleandeal-catalogmonitoring-list` |
| └ 팝업 | 클린거래 제보센터 (신규) | `sell-mydesk-cleandeal-itemSearch-popup.html` | `sell-mydesk-cleandeal-itemSearch-popup` |
| L3 | 등록 | `sell-mydesk-cleandeal-policyViolationtab-create.html` | `sell-mydesk-cleandeal-policyViolationtab-create` |
| L3 | 상세 | `sell-mydesk-cleandeal-policyViolationtab-detail.html` | `sell-mydesk-cleandeal-policyViolationtab-detail` |
| L3 | 목록 | `sell-mydesk-cleandeal-policyViolationtab-list.html` | `sell-mydesk-cleandeal-policyViolationtab-list` |

#### 10.18 견적관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 복사등록 (판매 관리) | `sell-mydesk-catalog-catalogCopy.html` | `sell-mydesk-catalog-catalogCopy` |
| L3 | 버전관리 (판매 관리) | `sell-mydesk-catalog-catalogVersion.html` | `sell-mydesk-catalog-catalogVersion` |
| L3 | 견적서제출목록 관리 | `sell-mydesk-quote-submitList.html` | `sell-mydesk-quote-submitList` |
| L3 | 견적서접수관리 | `sell-mydesk-quote-receiptList.html` | `sell-mydesk-quote-receiptList` |
| L3 | 카테고리관리 (견적관리) | `sell-mydesk-catalog-categoryManage.html` | `sell-mydesk-catalog-categoryManage` |
| L3 | 제조사·브랜드관리 (견적관리) | `sell-mydesk-catalog-brandManage.html` | `sell-mydesk-catalog-brandManage` |
| L3 | 요청건수제한관리 (견적관리) | `sell-mydesk-catalog-requestLimit.html` | `sell-mydesk-catalog-requestLimit` |

---

## 11. 공통

▎ 폴더: `공급자포털/공통/`

#### 11.1 인증/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공급업체 비밀번호 찾기/변경 | `S2B-SUP-AUTH-002_비밀번호찾기.html` | `S2B-SUP-AUTH-002_비밀번호찾기` |

---
