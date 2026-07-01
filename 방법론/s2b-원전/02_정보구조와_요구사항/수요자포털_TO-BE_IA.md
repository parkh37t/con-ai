# 수요자포털 TO-BE IA (표 형식)

> AS-IS 1Depth 14개 골격(불변) + 매핑된 TO-BE 폴더 안 화면을 표 형식으로 정리.
> 깊이 라벨: L2(1Depth 직속) · L3(서브폴더) · L4(서브의 서브) · `└ 팝업`/`└ 모달`/`└ tab`(파일명 패턴).

## 1. 메인

? 폴더: `수요자포털/메인/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 검색결과 | `buy-main-search.html` | `buy-main-search` |
| L2 | 인근 공급업체 조회 | `buy-main-searchResult.html` | `buy-main-searchResult` |

---

## 2. 1인수의 견적정보

? 폴더: `수요자포털/1인수의견적정보/`

> ※ 카테고리 leaf 45건(물품·용역·공사 분류)은 `_공통/카테고리/categories.js` SSOT로 동적 처리 ? `buy-catalog-Main.html` 내 필터/탭으로 표현되며 별도 HTML 파일은 생성하지 않음 (메모리 `category_ssot_policy.md` 정합)

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | BUY-A-IM-002 견적상세 | `BUY-A-IM-002_견적상세.html` | `BUY-A-IM-002_견적상세` |
| L2 | 견적 상세 | `buy-catalog-catalogDetailAddInfoTab.html` | `buy-catalog-catalogDetailAddInfoTab` |
| L2 | 견적 상세 | `buy-catalog-catalogDetailDeliveryTab.html` | `buy-catalog-catalogDetailDeliveryTab` |
| L2 | 견적 상세 | `buy-catalog-catalogDetailQuestionTab.html` | `buy-catalog-catalogDetailQuestionTab` |
| L2 | 견적 상세 | `buy-catalog-catalogDetailReviewTab.html` | `buy-catalog-catalogDetailReviewTab` |
| L2 | 1인수의 견적정보 서브메인 | `buy-catalog-eventMall.html` | `buy-catalog-eventMall` |
| L2 | 통합검색 | `buy-catalog-Main.html` | `buy-catalog-Main` |
| └ 팝업 | 다중 장바구니 선택 팝업 | `buy-catalog-MultiCartselectPopup.html` | `buy-catalog-MultiCartselectPopup` |
| └ 팝업 | 견적비교 추가 BUY-A-IM-0200P02T01·T02 | `buy-catalog-quoteCompareAddPopup.html` | `buy-catalog-quoteCompareAddPopup` |
| L2 | 견적정보 비교 결과 | `buy-catalog-quoteComparePrint.html` | `buy-catalog-quoteComparePrint` |
| L2 | 견적등록 | `buy-catalog-quoteCreate.html` | `buy-catalog-quoteCreate` |
| └ 팝업 | 견적 상세 | `buy-catalog-QuoteErrorPopup.html` | `buy-catalog-QuoteErrorPopup` |
| L2 | 견적서 접수목록 | `buy-catalog-quoteReceiptList.html` | `buy-catalog-quoteReceiptList` |
| L2 | 견적 상세 | `buy-catalog-sellerDetailInfoTab.html` | `buy-catalog-sellerDetailInfoTab` |
| L2 | 견적 상세 | `buy-catalog-sellerSearch.html` | `buy-catalog-sellerSearch` |
| L2 | 중소기업협동조합몰 | `buy-catalog-subMain-coop.html` | `buy-catalog-subMain-coop` |
| L2 | 에듀테크몰 | `buy-catalog-subMain-edutech.html` | `buy-catalog-subMain-edutech` |
| L2 | KC인증 어린이제품 몰 | `buy-catalog-subMain-kcKids.html` | `buy-catalog-subMain-kcKids` |
| L2 | 공공구매 전용몰 | `buy-catalog-subMain-publicProcurement.html` | `buy-catalog-subMain-publicProcurement` |
| L2 | s2b몰 | `buy-catalog-subMain.html` | `buy-catalog-subMain` |
| └ 팝업 | 접수자 지정 팝업 | `buy-catalog-userCart-receptionistPopup.html` | `buy-catalog-userCart-receptionistPopup` |
| └ 팝업 | 자동 이동 | `buy-catalog-userCart-receptionlistPopup.html` | `buy-catalog-userCart-receptionlistPopup` |
| └ 팝업 | SMPP 조합추천 연계 팝업 | `buy-catalog-userCart-SMPPopup.html` | `buy-catalog-userCart-SMPPopup` |
| └ 팝업 | 자동 이동 | `buy-catalog-userCart-SMPPPopup.html` | `buy-catalog-userCart-SMPPPopup` |
| L2 | 목록 | `buy-catalog-userCartlist.html` | `buy-catalog-userCartlist` |

---

## 3. 1인수의 견적요청

? 폴더: `수요자포털/1인수의견적요청/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 견적요청 계약접수 반려 팝업 | `buy-catalog-BuyRejectPopup.html` | `buy-catalog-BuyRejectPopup` |
| L2 | 견적요청 등록 | `buy-quote-quoteCreate.html` | `buy-quote-quoteCreate` |
| L2 | 1인수의 견적요청 상세 | `buy-quote-quoteDetailOrderApplyTab.html` | `buy-quote-quoteDetailOrderApplyTab` |
| L2 | 계약접수 | `buy-quote-quoteDetailOrderApplyTab.html` | `buy-quote-quoteDetailOrderApplyTab` |
| L2 | 업체선정 | `buy-quote-quoteDetailSelectionTab.html` | `buy-quote-quoteDetailSelectionTab` |
| L2 | 업체선정 | `buy-quote-quoteList.html` | `buy-quote-quoteList` |
| L2 | 이전 견적요청 검색 팝업 | `buy-quote-quoteListSearch.html` | `buy-quote-quoteListSearch` |

---

## 4. 2인수의 안내공고

? 폴더: `수요자포털/2인수의안내공고/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 계약접수 | `buy-posting-postingDetailOrderApplyTab.html` | `buy-posting-postingDetailOrderApplyTab` |
| L2 | 2인수의 안내공고 상세 | `buy-posting-postingDetailSelectionTab.html` | `buy-posting-postingDetailSelectionTab` |
| L2 | 목록 | `buy-posting-PostingList.html` | `buy-posting-PostingList` |

---

## 5. 입찰

? 폴더: `수요자포털/입찰/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 입찰 상세 | `buy-bid-bidDetailOrderApplyTab.html` | `buy-bid-bidDetailOrderApplyTab` |
| L2 | 계약접수 | `buy-bid-bidDetailOrderApplyTab.html` | `buy-bid-bidDetailOrderApplyTab` |
| └ 팝업 | 입찰 상세조회 팝업 | `buy-bid-bidDetailPopup.html` | `buy-bid-bidDetailPopup` |
| L2 | 업체선정 | `buy-bid-bidDetailSelectionTab.html` | `buy-bid-bidDetailSelectionTab` |
| L2 | 입찰공고 정정 | `buy-bid-bidDetailUpdate.html` | `buy-bid-bidDetailUpdate` |
| L2 | 목록 | `buy-bid-bidList.html` | `buy-bid-bidList` |
| L2 | 이전 입찰공고 검색 | `buy-bid-bidListSearch.html` | `buy-bid-bidListSearch` |
| L2 | 계약체결 탭 | `buy-mydesk-bid-bidDetailExecutionTab.html` | `buy-mydesk-bid-bidDetailExecutionTab` |
| L2 | 문서함 | `buy-mydesk-bid-bidDetailInboxDetail.html` | `buy-mydesk-bid-bidDetailInboxDetail` |
| L2 | 검수 탭 | `buy-mydesk-bid-bidDetailInspectionTab.html` | `buy-mydesk-bid-bidDetailInspectionTab` |
| L2 | 결제 탭 | `buy-mydesk-bid-bidPaymentTab.html` | `buy-mydesk-bid-bidPaymentTab` |

---

## 6. 연계정보

? 폴더: `수요자포털/연계정보/` + `수요자포털/계약공통업무/`

### 6.1 연계정보/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 발주계획 목록 (연계정보) | `buy-receipt-orderPlanList.html` | `buy-receipt-orderPlanList` |
| L2 | 발주계획 목록 | `buy-receipt-budgetS2BList.html` | `buy-receipt-budgetS2BList` |
| L2 | 상세 | `buy-receipt-budgetDetail.html` | `buy-receipt-budgetDetail` |
| L2 | 목록(에듀파인) | `buy-receipt-budgetEdufineList.html` | `buy-receipt-budgetEdufineList` |
| L2 | 발주계획 검색 | `buy-receipt-budgetEdulineSearch.html` | `buy-receipt-budgetEdulineSearch` |
| L2 | 목록(G2B) | `buy-receipt-budgetG2BList.html` | `buy-receipt-budgetG2BList` |
| L2 | 목록(S2B) | `buy-receipt-budgetS2BList.html` | `buy-receipt-budgetS2BList` |
| L2 | 발주계획 검색 | `buy-receipt-budgetSearch.html` | `buy-receipt-budgetSearch` |
| L2 | 에듀파인 연계 검색 | `buy-receipt-edufineInterfaceSearch.html` | `buy-receipt-edufineInterfaceSearch` |
| L2 | 사전규격 목록 | `buy-receipt-prespecS2BList.html` | `buy-receipt-prespecS2BList` |
| L2 | 상세 | `buy-receipt-prespecDetail.html` | `buy-receipt-prespecDetail` |
| L2 | 목록(에듀파인) | `buy-receipt-prespecEdufineList.html` | `buy-receipt-prespecEdufineList` |
| L2 | 목록(G2B) | `buy-receipt-prespecG2BList.html` | `buy-receipt-prespecG2BList` |
| L2 | 목록(S2B) | `buy-receipt-prespecS2BList.html` | `buy-receipt-prespecS2BList` |
| L2 | 사전규격 검색 | `buy-receipt-prespecSearch.html` | `buy-receipt-prespecSearch` |
| L2 | 사전규격 공급업체 의견 상세 | `buy-receipt-prespecSellerOpinionDetail.html` | `buy-receipt-prespecSellerOpinionDetail` |
| L2 | 조합추천 SMPP 검색 | `buy-receipt-smppSearch.html` | `buy-receipt-smppSearch` |

### 6.2 계약공통업무/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 계약서 생성 | `buy-contract-create.html` | `buy-contract-create` |
| └ 팝업 | 취소사유 입력 (계약공통 ? 1인수의 견적요청·2인수의 안내공고·입찰 공용) | `buy-contract-receiptCancelPopup.html` | `buy-contract-receiptCancelPopup` |
| └ 팝업 | 수입인지 부착 팝업 | `buy-contract-receiptStampbuyPopup.html` | `buy-contract-receiptStampbuyPopup` |
| └ 팝업 | 수입인지세액 입력 팝업 | `buy-contract-receiptStampTaxDetailPopup.html` | `buy-contract-receiptStampTaxDetailPopup` |
| └ 팝업 | 구매총액 조회 팝업 | `buy-contract-taxInputPopup.html` | `buy-contract-taxInputPopup` |

---

## 7. 리포팅/통계

? 폴더: `수요자포털/리포팅통계/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 공공구매 실적 등록 | `buy-mydesk-contract-publicBuyCreate.html` | `buy-mydesk-contract-publicBuyCreate` |
| L2 | 화면이 마이그레이션되었습니다 | `buy-mydesk-contract-publicBuyDetail.html` | `buy-mydesk-contract-publicBuyDetail` |
| L2 | 공공구매 실적 목록 | `buy-mydesk-contract-publicBuyList.html` | `buy-mydesk-contract-publicBuyList` |
| L2 | 공급업체 통계정보 | `buy-report-buyerByEdu.html` | `buy-report-buyerByEdu` |
| L2 | 공급업체 통계정보 | `buy-report-buyerPurchased.html` | `buy-report-buyerPurchased` |
| L2 | 공급업체 통계정보 | `buy-report-sellerRegion.html` | `buy-report-sellerRegion` |
| L2 | 공급업체 통계정보 | `buy-report-sellerServiceType.html` | `buy-report-sellerServiceType` |
| L2 | 공급업체 통계정보 (통합) | `buy-report-sellerStatistics.html` | `buy-report-sellerStatistics` |
| L2 | 공급업체 통계 (상위) | `buy-report-topSeller.html` | `buy-report-topSeller` |

---

## 8. 알림/커뮤니케이션

? 폴더: `수요자포털/알림커뮤니케이션/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 견적정보 선택 (별창 모달) | `buy-notification-communityCatalogSelectBulkPopup.html` | `buy-notification-communityCatalogSelectBulkPopup` |
| L2 | 청구 | `buy-notification-communityClaim.html` | `buy-notification-communityClaim` |
| L2 | 커뮤니티 등록/수정 | `buy-notification-communityCreate.html` | `buy-notification-communityCreate` |
| L2 | 게시글 상세 | `buy-notification-communityDetail.html` | `buy-notification-communityDetail` |
| L2 | 커뮤니티 목록 | `buy-notification-communityList.html` | `buy-notification-communityList` |
| L2 | 공지 상세 | `buy-notification-communityNotice.html` | `buy-notification-communityNotice` |
| L2 | 참가 신청 | `buy-notification-eventApply.html` | `buy-notification-eventApply` |
| L2 | 상세 | `buy-notification-eventDetail.html` | `buy-notification-eventDetail` |
| L2 | 이벤트 목록 | `buy-notification-eventList.html` | `buy-notification-eventList` |
| L2 | 결과 조회 | `buy-notification-eventResult.html` | `buy-notification-eventResult` |
| L2 | 체험단 신청 | `buy-notification-testerApply.html` | `buy-notification-testerApply` |
| L2 | 체험단 상세 | `buy-notification-testerDetail.html` | `buy-notification-testerDetail` |
| L2 | 체험단 목록 | `buy-notification-testerList.html` | `buy-notification-testerList` |
| L2 | 체험단 후기 등록 | `buy-notification-testerReviewCreate.html` | `buy-notification-testerReviewCreate` |
| L2 | 기획전 목록 | `buy-display-exhibitionList.html` | `buy-display-exhibitionList_기획전목록` |
| L2 | 기획전 상세 | `buy-display-exhibitionDetail.html` | `buy-display-exhibitionDetail_기획전상세` |

---

## 9. 고객지원

? 폴더: `수요자포털/고객지원/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 고객센터안내 | `buy-support-ars.html` | `buy-support-ars` |
| └ 팝업 | 1:1 문의하기 (풀오버레이) | `buy-support-askCreate-popup.html` | `buy-support-askCreate-popup` |
| L2 | S2B 이용 우수기관 | `buy-support-awardCount.html` | `buy-support-awardCount` |
| L2 | 조달금액 | `buy-support-awardAmount.html` | `buy-support-awardAmount` |
| L2 | 조달건수 | `buy-support-awardCount.html` | `buy-support-awardCount` |
| L2 | S2B 안내 ? BI | `buy-support-bi.html` | `buy-support-bi` |
| L2 | PR센터 브로슈어 | `buy-support-brochure.html` | `buy-support-brochure` |
| L2 | S2B경험행사 상세 | `buy-support-campaignDetail.html` | `buy-support-campaignDetail` |
| L2 | S2B경험행사 목록 | `buy-support-campaignList.html` | `buy-support-campaignList` |
| L2 | 지역센터 안내 | `buy-support-center.html` | `buy-support-center` |
| L2 | 통합로그인 인증서안내 | `buy-support-certificateInfo.html` | `buy-support-certificateInfo` |
| L2 | 통합 자료실 상세 | `buy-support-commonsHubDetail.html` | `buy-support-commonsHubDetail` |
| L2 | 목록 | `buy-support-commonsHubList.html` | `buy-support-commonsHubList` |
| L2 | 용어사전 | `buy-support-dictionary.html` | `buy-support-dictionary` |
| L2 | 자주 묻는 질문(FAQ) | `buy-support-faq.html` | `buy-support-faq` |
| L2 | 연혁 | `buy-support-history.html` | `buy-support-history` |
| L2 | 소개 | `buy-support-introduce.html` | `buy-support-introduce` |
| L2 | 법령 자료실 상세 | `buy-support-lawHubDetail.html` | `buy-support-lawHubDetail` |
| L2 | 법령 자료실 목록 | `buy-support-lawhubList.html` | `buy-support-lawhubList` |
| L2 | 통합로그인 로그인안내 | `buy-support-loginInfo.html` | `buy-support-loginInfo` |
| L2 | S2B주요행사 상세 | `buy-support-mainEventDetail.html` | `buy-support-mainEventDetail` |
| L2 | S2B주요행사 | `buy-support-mainEventList.html` | `buy-support-mainEventList` |
| L2 | 온라인매뉴얼 | `buy-support-manual.html` | `buy-support-manual` |
| L2 | 미디어 | `buy-support-media.html` | `buy-support-media` |
| L2 | 통합로그인 회원안내 | `buy-support-MembershipInfo.html` | `buy-support-MembershipInfo` |
| L2 | 모바일서비스 안내 | `buy-support-mobileService.html` | `buy-support-mobileService` |
| L2 | 뉴스룸 상세 | `buy-support-newsroomDetail.html` | `buy-support-newsroomDetail` |
| L2 | 뉴스룸 목록 | `buy-support-newsroomList.html` | `buy-support-newsroomList` |
| L2 | 상세 | `buy-support-noticeDetail.html` | `buy-support-noticeDetail` |
| L2 | 목록 | `buy-support-noticeList.html` | `buy-support-noticeList` |
| └ 팝업 | 텍스트 팝업 | `buy-support-noticeTextpopup.html` | `buy-support-noticeTextpopup` |
| L2 | 개인정보처리방침 | `buy-support-selfPrivacy.html` | `buy-support-selfPrivacy` |
| L2 | 시스템이용도우미 | `buy-support-systemHelp.html` | `buy-support-systemHelp` |
| L2 | 이용약관 | `buy-support-terms.html` | `buy-support-terms` |
| L2 | 교육연수 목록 | `buy-support-trainingList.html` | `buy-support-trainingList` |
| L2 | 캘린더목록 | `buy-support-trainingCalendar.html` | `buy-support-trainingCalendar` |
| L2 | 교육연수 상세 | `buy-support-trainingDetail.html` | `buy-support-trainingDetail` |
| L2 | 리스트목록 | `buy-support-trainingList.html` | `buy-support-trainingList` |
| L2 | 방문교육 신청 | `buy-support-trainingVisitCreate.html` | `buy-support-trainingVisitCreate` |
| L2 | 체험단 안내 | `buy-support-trial.html` | `buy-support-trial` |

---

## 10. 이용자그룹 관리

? _(매핑되는 TO-BE 폴더 없음 ? IA 정의 필요)_

---

## 11. 수요기관 이용자 등록

? 폴더: `수요자포털/회원가입/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 관리자 정보 수정 | `buy-masterUpdateinfo.html` | `buy-masterUpdateinfo` |
| L2 | 약관동의 | `buy-member-agree.html` | `buy-member-agree` |
| L2 | 결제대행 이용약관 | `buy-member-agreePayment.html` | `buy-member-agreePayment` |
| L2 | 자동 이동 (legacy alias) | `buy-member-agreePrivacyPliicyConsent.html` | `buy-member-agreePrivacyPliicyConsent` |
| └ 팝업 | 자동 이동 | `buy-member-agreePrivacyPliicyConsentpopup.html` | `buy-member-agreePrivacyPliicyConsentpopup` |
| L2 | 개인정보 수집·이용 | `buy-member-agreePrivacyConsent.html` | `buy-member-agreePrivacyConsent` |
| └ 팝업 | 개인정보 수집·이용 약관 | `buy-member-agreePrivacyPolicyConsentpopup.html` | `buy-member-agreePrivacyPolicyConsentpopup` |
| └ 팝업 | 안내·홍보 정보수신 약관 | `buy-member-agreePublicityPopup.html` | `buy-member-agreePublicityPopup` |
| └ 팝업 | 자동 이동 | `buy-member-agreepublictypopup.html` | `buy-member-agreepublictypopup` |
| L2 | 이용약관 | `buy-member-agreeTermsOfUse.html` | `buy-member-agreeTermsOfUse` |
| L2 | 서비스 이용약관 | `buy-member-agreeTermsOfUse.html` | `buy-member-agreeTerms` |
| L2 | 화면이 통합되었습니다 | `buy-member-bankSealCreate.html` | `buy-member-bankSealCreate` |
| L2 | 기관 예치금 관리 | `buy-member-companyDeposit.html` | `buy-member-companyDeposit` |
| L2 | 기관정보 등록 | `buy-member-companyRegistCreate.html` | `buy-member-companyRegistCreate` |
| L2 | 신청완료 | `buy-member-companyRegistDone.html` | `buy-member-companyRegistDone` |
| L2 | 교육디지털원패스 로그인 | `buy-member-eduAuthLogin.html` | `buy-member-eduAuthLogin` |
| L2 | 법인카드 등록 | `buy-member-governmentComcardCreate.html` | `buy-member-governmentComcardCreate` |
| L2 | 법인카드 등록 팝업 목록 | `buy-member-governmentComcardCreateList.html` | `buy-member-governmentComcardCreateList` |
| L2 | 권한그룹 상세 | `buy-member-groupAddMember.html` | `buy-member-groupAddMember` |
| L2 | 이용자 등록 (USR-003) | `buy-member-groupCreate.html` | `buy-member-groupCreate` |
| L2 | 권한그룹 등록 | `buy-member-groupDetail.html` | `buy-member-groupDetail` |
| L2 | 권한그룹 목록 | `buy-member-groupList.html` | `buy-member-groupList` |
| L2 | 담당자정보 등록 | `buy-member-masterCreate.html` | `buy-member-masterCreate` |
| L2 | 개인이용자 승인 | `buy-member-memberApproval.html` | `buy-member-memberApproval` |
| L2 | 개인이용자 기본정보 등록 | `buy-member-memberbasicInfo.html` | `buy-member-memberbasicInfo` |
| L2 | 이용자 소속 삭제 | `buy-member-memberCompanyDelete.html` | `buy-member-memberCompanyDelete` |
| L2 | 이용자 상세 | `buy-member-memberDetail.html` | `buy-member-memberDetail` |
| L2 | 이용자 상세 (승인완료) | `buy-member-memberDone.html` | `buy-member-memberDone` |
| L2 | 이용자 관리 목록 | `buy-member-memberList.html` | `buy-member-memberList` |
| L2 | 이용자 반려 | `buy-member-memberReject.html` | `buy-member-memberReject` |
| L2 | 수요기관 조회 | `buy-member-searchCompanyCode.html` | `buy-member-searchCompanyCode` |
| L2 | 이용자 검색 | `buy-member-searchMember.html` | `buy-member-searchMember` |
| L2 | 행정표준기관 조회 결과 | `buy-member-searchGoveResult.html` | `buy-member-searchGoveResult` |
| L2 | S2B 등록기관 조회 결과 | `buy-member-searchS2BResult.html` | `buy-member-searchS2BResult` |
| L2 | S2B 이용자 등록 (1/3 약관동의) | `buy-member-agree.html` | `buy-member-agree` | <!-- 260510-WAVE2-ATOMIC-SPLIT -->
| L2 | S2B 이용자 등록 (2/3 기본정보) | `buy-member-info.html` | `buy-member-info` |
| L2 | S2B 이용자 등록 (3/3 가입완료) | `buy-member-complete.html` | `buy-member-complete` |
| L2 | 기관정보 수정 | `buy-organizationinfo.html` | `buy-organizationinfo` |

---

## 12. 이용자 등록

? _(매핑되는 TO-BE 폴더 없음 ? IA 정의 필요)_

---

## 13. 마이데스크

? 폴더: `수요자포털/마이데스크/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 계약접수 탭 | `buy-mydesk-bid-bidDetailOrderApplyTab.html` | `buy-mydesk-bid-bidDetailOrderApplyTab` |
| L2 | 업체선정 탭 | `buy-mydesk-bid-bidDetailSelectionTab.html` | `buy-mydesk-bid-bidDetailSelectionTab` |
| L2 | 계약체결 탭 | `buy-mydesk-catalog-catalogDetailExecutionTab.html` | `buy-mydesk-catalog-catalogDetailExecutionTab` |
| L2 | 문서함 탭 | `buy-mydesk-catalog-catalogDetailInboxDetail.html` | `buy-mydesk-catalog-catalogDetailInboxDetail` |
| L2 | 검수 탭 | `buy-mydesk-catalog-catalogDetailInspectionTab.html` | `buy-mydesk-catalog-catalogDetailInspectionTab` |
| L2 | 결제 탭 | `buy-mydesk-catalog-catalogDetailPaymentTab.html` | `buy-mydesk-catalog-catalogDetailPaymentTab` |
| L2 | 업체선정 탭 | `buy-mydesk-catalog-catalogDetailSelectionTab.html` | `buy-mydesk-catalog-catalogDetailSelectionTab` |
| L2 | 계약체결 탭 | `buy-mydesk-posting-postingDetailExecutionTab.html` | `buy-mydesk-posting-postingDetailExecutionTab` |
| L2 | 문서함 탭 | `buy-mydesk-posting-postingDetailInboxDetail.html` | `buy-mydesk-posting-postingDetailInboxDetail` |
| L2 | 검수 탭 | `buy-mydesk-posting-postingDetailInspectionTab.html` | `buy-mydesk-posting-postingDetailInspectionTab` |
| L2 | 계약접수 탭 | `buy-mydesk-posting-postingDetailOrderApplyTab.html` | `buy-mydesk-posting-postingDetailOrderApplyTab` |
| L2 | 결제 탭 | `buy-mydesk-posting-postingDetailPaymentTab.html` | `buy-mydesk-posting-postingDetailPaymentTab` |
| L2 | 업체선정 탭 | `buy-mydesk-posting-postingDetailSelectionTab.html` | `buy-mydesk-posting-postingDetailSelectionTab` |
| L2 | 계약체결 탭 | `buy-mydesk-quote-quoteDetailExecutionTab.html` | `buy-mydesk-quote-quoteDetailExecutionTab` |
| L2 | 문서함 탭 | `buy-mydesk-quote-quoteDetailInboxDetail.html` | `buy-mydesk-quote-quoteDetailInboxDetail` |
| L2 | 검수 탭 | `buy-mydesk-quote-quoteDetailInspectionTab.html` | `buy-mydesk-quote-quoteDetailInspectionTab` |
| L2 | 계약접수 탭 | `buy-mydesk-quote-quoteDetailOrderApplyTab.html` | `buy-mydesk-quote-quoteDetailOrderApplyTab` |
| L2 | 결제 탭 | `buy-mydesk-quote-quoteDetailPaymentTab.html` | `buy-mydesk-quote-quoteDetailPaymentTab` |
| L2 | 업체선정 탭 | `buy-mydesk-quote-quoteDetailSelectionTab.html` | `buy-mydesk-quote-quoteDetailSelectionTab` |
| L2 | 목록(G2B) | `buy-mydesk-receipt-budgetG2BList.html` | `buy-mydesk-receipt-budgetG2BList` |
| L2 | 목록(S2B) | `buy-mydesk-receipt-budgetS2BList.html` | `buy-mydesk-receipt-budgetS2BList` |
| L2 | 목록(G2B) | `buy-mydesk-receipt-prespecG2BList.html` | `buy-mydesk-receipt-prespecG2BList` |
| L2 | 목록(S2B) | `buy-mydesk-receipt-prespecS2BList.html` | `buy-mydesk-receipt-prespecS2BList` |

#### 13.1 1인수의견적요청/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 취소사유 입력 (계약공통으로 이전) | `../계약공통업무/buy-contract-receiptCancelPopup.html` | `buy-contract-receiptCancelPopup` (기존 `buy-mydesk-quote-quoteCancelPopup`는 redirect stub) |
| L3 | 선택 견적비교 | `buy-mydesk-quote-quoteCompare.html` | `buy-mydesk-quote-quoteCompare` |
| L3 | 견적요청 등록 | `buy-mydesk-quote-quoteCreate.html` | `buy-mydesk-quote-quoteCreate` |
| L3 | 견적요청 상세 | `buy-mydesk-quote-quoteDetailOrderApplyTab.html` | `buy-mydesk-quote-quoteDetailOrderApplyTab` |
| └ 팝업 | 상세조회 팝업 | `buy-quote-quoteDetailPopup.html` | `buy-quote-quoteDetailPopup` |
| L3 | 견적요청 업체선정 수의시담 상세 | `buy-mydesk-quote-quoteDetailSelectionNegoDetail.html` | `buy-mydesk-quote-quoteDetailSelectionNegoDetail` |
| L3 | 견적요청 수정 | `buy-mydesk-quote-quoteDetailUpdate.html` | `buy-mydesk-quote-quoteDetailUpdate` |
| L3 | 계약상대자 추첨 | `buy-mydesk-quote-quoteSelectionDraw.html` | `buy-mydesk-quote-quoteSelectionDraw` |
| L3 | 계약상대자 추첨 결과 | `buy-mydesk-quote-quoteSelectionDrawResult.html` | `buy-mydesk-quote-quoteSelectionDrawResult` |

#### 13.2 1인수의견적정보/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 1인수의 견적정보 계약 상세 | `buy-mydesk-catalog-catalogDetailSelectionTab.html` | `buy-mydesk-catalog-catalogDetailSelectionTab` |
| L3 | 등록 | `buy-mydesk-catalog-catalogErrorCreate.html` | `buy-mydesk-catalog-catalogErrorCreate` |
| L3 | 카탈로그 오류 상세 | `buy-mydesk-catalog-catalogErrorDetail.html` | `buy-mydesk-catalog-catalogErrorDetail` |
| L3 | 목록 | `buy-mydesk-catalog-catalogErrorList.html` | `buy-mydesk-catalog-catalogErrorList` |
| L3 | 본 화면은 alias입니다 | `buy-mydesk-catalog-catalogSellerPick.html` | `buy-mydesk-catalog-catalogSellerPick` |

#### 13.3 2인수의안내공고/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공고 목록 | `buy-mydesk-posting-postingCreate.html` | `buy-mydesk-posting-postingCreate` |
| L3 | 안내공고 상세 | `buy-mydesk-posting-postingDetailOrderApplyTab.html` | `buy-mydesk-posting-postingDetailOrderApplyTab` |
| └ 팝업 | 상세조회 팝업 | `buy-mydesk-posting-postingDetailPopup.html` | `buy-mydesk-posting-postingDetailPopup` |
| L3 | 본 화면은 alias입니다 | `buy-mydesk-posting-PostingList.html` | `buy-mydesk-posting-PostingList` |
| L3 | 안내공고 목록 검색 | `buy-mydesk-posting-postingListSearch.html` | `buy-mydesk-posting-postingListSearch` |
| L3 | 안내공고 공사 양식 | `buy-mydesk-posting-postingNoticeSampleConstruction.html` | `buy-mydesk-posting-postingNoticeSampleConstruction` |
| L3 | 안내공고 물품 양식 | `buy-mydesk-posting-postingNoticeSampleGoods.html` | `buy-mydesk-posting-postingNoticeSampleGoods` |
| L3 | 안내공고 인쇄 양식 | `buy-mydesk-posting-postingNoticeSamplePrint.html` | `buy-mydesk-posting-postingNoticeSamplePrint` |
| L3 | 안내공고 용역 양식 | `buy-mydesk-posting-postingNoticeSampleServices.html` | `buy-mydesk-posting-postingNoticeSampleServices` |
| L3 | 정정 | `buy-mydesk-posting-postingUpdate.html` | `buy-mydesk-posting-postingUpdate` |

#### 13.4 검수관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 검수요청 등록 | `buy-mydesk-inspection-deliveryRequestCreate.html` | `buy-mydesk-inspection-deliveryRequestCreate` |
| L3 | 검수요청 상세 | `buy-mydesk-inspection-deliveryRequestDetail.html` | `buy-mydesk-inspection-deliveryRequestDetail` |
| └ 팝업 | 배송조회 팝업 | `buy-mydesk-inspection-deliverySearchPopup.html` | `buy-mydesk-inspection-deliverySearchPopup` |
| └ 팝업 | 만족도평가 팝업 | `buy-mydesk-inspection-evalPopup.html` | `buy-mydesk-inspection-evalPopup` |
| L3 | 업체 만족도 평가 | `buy-mydesk-inspection-GoodsReview.html` | `buy-mydesk-inspection-GoodsReview` |
| L3 | 검수요청 승인 | `buy-mydesk-inspection-inspectionAccept.html` | `buy-mydesk-inspection-inspectionAccept` |
| L3 | 검수판정 | `buy-mydesk-inspection-inspectionCreate.html` | `buy-mydesk-inspection-inspectionCreate` |
| L3 | 검수요청 반려 | `buy-mydesk-inspection-inspectionReject.html` | `buy-mydesk-inspection-inspectionReject` |
| L3 | 검수요청 조회 | `buy-mydesk-inspection-inspectionRequestDetail.html` | `buy-mydesk-inspection-inspectionRequestDetail` |
| L3 | 검수요청 반려 | `buy-mydesk-inspection-inspectionRequestReject.html` | `buy-mydesk-inspection-inspectionRequestReject` |
| L3 | 서비스상세 검수 탭 | `buy-mydesk-inspection-inspectionTab.html` | `buy-mydesk-inspection-inspectionTab` |
| L3 | 등록 | `buy-mydesk-inspection-rejectionCreate.html` | `buy-mydesk-inspection-rejectionCreate` |
| L3 | 상세 | `buy-mydesk-inspection-rejectionDetail.html` | `buy-mydesk-inspection-rejectionDetail` |
| L3 | 공급업체 만족도 평가 | `buy-mydesk-inspection-SellerReview.html` | `buy-mydesk-inspection-SellerReview` |
| L3 | 검수요청 취소 | `buy-mydesk-inspection-uninspectRequest.html` | `buy-mydesk-inspection-uninspectRequest` |

#### 13.5 결제관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 잔금 신청 검토 | `buy-mydesk-payment-balanceAccept.html` | `buy-mydesk-payment-balanceAccept` |
| └ 팝업 | 잔금 신청 상세 | `buy-mydesk-payment-balanceDetailPopup.html` | `buy-mydesk-payment-balanceDetailPopup` |
| L3 | 이용수수료 결제 | `buy-mydesk-payment-creditPayment.html` | `buy-mydesk-payment-creditPayment` |
| L3 | 일괄지급 신청 검토 | `buy-mydesk-payment-paymentAccept.html` | `buy-mydesk-payment-paymentAccept` |
| └ 팝업 | 일괄지급 상세 | `buy-mydesk-payment-paymentDetailPopup.html` | `buy-mydesk-payment-paymentDetailPopup` |
| L3 | 선금 신청 검토 | `buy-mydesk-payment-prepayAccept.html` | `buy-mydesk-payment-prepayAccept` |
| └ 팝업 | 선금 신청서 상세 | `buy-mydesk-payment-prepayDetailPopup.html` | `buy-mydesk-payment-prepayDetailPopup` |
| L3 | 기성금 신청 검토 | `buy-mydesk-payment-progressAccept.html` | `buy-mydesk-payment-progressAccept` |
| └ 팝업 | 기성금 신청 상세 | `buy-mydesk-payment-progressDetailPopup.html` | `buy-mydesk-payment-progressDetailPopup` |
| └ 팝업 | 결제 반려 | `buy-mydesk-payment-rejectPopup.html` | `buy-mydesk-payment-rejectPopup` |
| └ 팝업 | 국세/지방세 완납여부 조회 | `buy-mydesk-payment-taxClearCheckPopup.html` | `buy-mydesk-payment-taxClearCheckPopup` |

#### 13.6 계약공통업무/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 단가계약 기초금액 등록 | `buy-contract-baseUnitPricePopup.html` | `buy-contract-baseUnitPricePopup` |
| L3 | S2B 물품번호 조회 | `buy-contract-catalogNumberSearch.html` | `buy-contract-catalogNumberSearch` |
| L3 | 계약 생성 | `buy-contract-Create.html` | `buy-contract-Create` |
| └ 팝업 | 에듀파인 인증 팝업 | `buy-contract-edufinePassPopup.html` | `buy-contract-edufinePassPopup` |
| L3 | 견적서 총액 확인 | `buy-contract-estimateTotalAmount.html` | `buy-contract-estimateTotalAmount` |
| L3 | 견적서 오류 체크 | `buy-contract-estimateUnitPrice.html` | `buy-contract-estimateUnitPrice` |
| └ 팝업 | G2B 인증 팝업 | `buy-contract-g2bPassPopup.html` | `buy-contract-g2bPassPopup` |
| L3 | 제한업종 검색 | `buy-contract-limitSectorSearch.html` | `buy-contract-limitSectorSearch` |
| └ 팝업 | 국세청 통합인증 팝업 | `buy-contract-recept-orderPopup.html` | `buy-contract-recept-orderPopup` |
| └ 팝업 | 수입인지 구매 팝업 | `buy-contract-receptStampBuyPopup.html` | `buy-contract-receptStampBuyPopup` |
| └ 팝업 | 인지세 납부결과 조회 | `buy-contract-receptStamptaxDetailPopup.html` | `buy-contract-receptStamptaxDetailPopup` |
| └ 팝업 | 공급업체 정보 조회 팝업 | `buy-contract-sellerDocumentPopup.html` | `buy-contract-sellerDocumentPopup` |
| └ 팝업 | 업체선정 불가 | `buy-contract-sellerInvalidPopup.html` | `buy-contract-sellerInvalidPopup` |
| └ 팝업 | 조달청 인증 팝업 | `buy-contract-taxLinkPassPopup.html` | `buy-contract-taxLinkPassPopup` |
| └ 팝업 | 임시저장 확인 팝업 | `buy-contract-tempDataConfirmPopup.html` | `buy-contract-tempDataConfirmPopup` |
| └ 팝업 | 임시저장 삭제 팝업 | `buy-contract-tempDataDeletePopup.html` | `buy-contract-tempDataDeletePopup` |
| L3 | 공급업체 신고 팝업 | `buy-mydesk-execution-draftCheckReport.html` | `buy-mydesk-execution-draftCheckReport` |
| L3 | 계약 해제/해지 요청 | `buy-mydesk-execution-draftRelease.html` | `buy-mydesk-execution-draftRelease` |
| L3 | 계약 해제/해지 검토 | `buy-mydesk-execution-draftReleaseCheck.html` | `buy-mydesk-execution-draftReleaseCheck` |
| L3 | 공급업체 신고 팝업 | `buy-mydesk-execution-draftReleaseCheckReport.html` | `buy-mydesk-execution-draftReleaseCheckReport` |
| L3 | 반품요청 등록 | `buy-mydesk-execution-draftUpdate.html` | `buy-mydesk-execution-draftUpdate` |
| L3 | 변경계약서 검토 | `buy-mydesk-execution-updateDraftCheck.html` | `buy-mydesk-execution-updateDraftCheck` |

#### 13.7 관심공고계약현황/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약목록 | `buy-mydesk-contract-contractList.html` | `buy-mydesk-contract-contractList` |
| L3 | 대시보드 | `buy-mydesk-contract-dashboard.html` | `buy-mydesk-contract-dashboard` |
| L3 | 계약접수 목록 | `buy-mydesk-contract-orderApplyList.html` | `buy-mydesk-contract-orderApplyList` |
| L3 | 계약접수 임시저장 목록 | `buy-mydesk-contract-pendingList.html` | `buy-mydesk-contract-pendingList` |
| L3 | 공공구매 실적 등록 | `buy-mydesk-contract-publicBuyCreate.html` | `buy-mydesk-contract-publicBuyCreate` |
| L3 | 화면이 마이그레이션되었습니다 | `buy-mydesk-contract-publicBuyDetail.html` | `buy-mydesk-contract-publicBuyDetail` |
| L3 | 공공구매 실적 목록 | `buy-mydesk-contract-publicBuyList.html` | `buy-mydesk-contract-publicBuyList` |
| L3 | 관심상품 목록 | `buy-mydesk-contract-wishCatalog-sharequote.html` | `buy-mydesk-contract-wishCatalog-sharequote` |
| L3 | 관심상품 상세 | `buy-mydesk-contract-wishCatalog-sharequoteDetail.html` | `buy-mydesk-contract-wishCatalog-sharequoteDetail` |
| L3 | 목록 | `buy-mydesk-contract-wishlist.html` | `buy-mydesk-contract-wishlist` |
| L3 | 관심공고 상세 | `buy-mydesk-contract-wishSellerDetail.html` | `buy-mydesk-contract-wishSellerDetail` |
| L3 | 관심공고 목록 | `buy-mydesk-contract-wishSellerList.html` | `buy-mydesk-contract-wishSellerList` |

#### 13.8 교육고객지원/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 등록 | `buy-mydesk-support-askCreate.html` | `buy-mydesk-support-askCreate` |
| L3 | 상세 | `buy-mydesk-support-askDetail.html` | `buy-mydesk-support-askDetail` |
| L3 | 목록 | `buy-mydesk-support-askList.html` | `buy-mydesk-support-askList` |
| L3 | 마이데스크 신고 게시글 상세 | `buy-mydesk-support-communityClaimDetail.html` | `buy-mydesk-support-communityClaimDetail` |
| L3 | 마이데스크 신고 게시글 목록 | `buy-mydesk-support-communityClaimList.html` | `buy-mydesk-support-communityClaimList` |
| L3 | 마이데스크 좋아요 게시글 상세 | `buy-mydesk-support-communityDetail.html` | `buy-mydesk-support-communityDetail` |
| L3 | 마이데스크 스크랩 게시글 목록 | `buy-mydesk-support-communityLike.html` | `buy-mydesk-support-communityLike` |
| L3 | 마이데스크 좋아요 게시글 목록 | `buy-mydesk-support-communityList.html` | `buy-mydesk-support-communityList` |
| L3 | 마이데스크 스크랩 게시글 상세 | `buy-mydesk-support-communityScrap.html` | `buy-mydesk-support-communityScrap` |
| L3 | 교육연수 상세 | `buy-mydesk-support-trainingDetail.html` | `buy-mydesk-support-trainingDetail` |
| L3 | 교육연수 목록 | `buy-mydesk-support-trainingList.html` | `buy-mydesk-support-trainingList` |
| L3 | 방문신청 상세 | `buy-mydesk-support-trainingOfflineDetail.html` | `buy-mydesk-support-trainingOfflineDetail` |
| L3 | 방문신청 목록 | `buy-mydesk-support-trainingOfflineList.html` | `buy-mydesk-support-trainingOfflineList` |

#### 13.9 마이페이지/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 개인이용자 탈퇴 | `buy-mydesk-member-profiledeletpassword.html` | `S2B-DMD-MYPAGE-002_개인이용자탈퇴` |
| L3 | 수요기관 탈퇴 | `S2B-DMD-MYPAGE-003_수요기관탈퇴.html` | `S2B-DMD-MYPAGE-003_수요기관탈퇴` |

#### 13.10 알림함/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 본 화면은 alias입니다 | `buy-mydesk-notification-notificationDetail.html` | `buy-mydesk-notification-notificationDetail` |
| L3 | 본 화면은 alias입니다 | `buy-mydesk-notification-notificationList.html` | `buy-mydesk-notification-notificationList` |
| L3 | 본 화면은 alias입니다 | `buy-mydesk-notification-notificationSetting.html` | `buy-mydesk-notification-notificationSetting` |
| L3 | 알림함 상세 | `buy-mydesk-notificationDetail.html` | `buy-mydesk-notificationDetail` |
| L3 | 목록 | `buy-mydesk-notificationList.html` | `buy-mydesk-notificationList` |
| L3 | 알림 설정 | `buy-mydesk-notificationSetting.html` | `buy-mydesk-notificationSetting` |

#### 13.11 업체선정수의시담/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 기술능력심사점수 등록/조회 팝업 | `buy-mydesk-selection-bidScorePopup.html` | `buy-mydesk-selection-bidScorePopup` |
| └ 팝업 | 기술능력 심사 수행 팝업 | `buy-mydesk-selection-bidSellerEvalScorePopup.html` | `buy-mydesk-selection-bidSellerEvalScorePopup` |
| └ 팝업 | 적격심사 수행 팝업 | `buy-mydesk-selection-bidSellerScorePopup.html` | `buy-mydesk-selection-bidSellerScorePopup` |
| └ 팝업 | 입찰자 조회 팝업 | `buy-mydesk-selection-bidSellerSearchPopup.html` | `buy-mydesk-selection-bidSellerSearchPopup` |
| └ 팝업 | 규격심사 수행 팝업 | `buy-mydesk-selection-bidSellerSpecScorePopup.html` | `buy-mydesk-selection-bidSellerSpecScorePopup` |
| └ 팝업 | 유찰 등록 | `buy-mydesk-selection-bidVoidPopup.html` | `buy-mydesk-selection-bidVoidPopup` |
| L3 | 견적정보 | `buy-mydesk-selection-catalogNegoCreate.html` | `buy-mydesk-selection-catalogNegoCreate` |
| L3 | 견적정보 | `buy-mydesk-selection-catalogNegoDetail.html` | `buy-mydesk-selection-catalogNegoDetail` |
| L3 | 계약상대자 결정 | `buy-mydesk-selection-catalogSellerPick.html` | `buy-mydesk-selection-catalogSellerPick` |
| L3 | 계약체결자격 부적격 업체 제외 | `buy-mydesk-selection-contractAbilityFail.html` | `buy-mydesk-selection-contractAbilityFail` |
| L3 | 계약체결자격 확인 팝업 | `buy-mydesk-selection-contractAbilityPass.html` | `buy-mydesk-selection-contractAbilityPass` |
| L3 | 1인수의 견적정보 견적서 접수 목록 | `buy-mydesk-selection-contractList.html` | `buy-mydesk-selection-contractList` |
| L3 | 수의시담 요청 상세 | `buy-mydesk-selection-contractNegoDetail.html` | `buy-mydesk-selection-contractNegoDetail` |
| L3 | 공공업체 이용제한관리 등록 | `buy-mydesk-selection-limitSellerCreate.html` | `buy-mydesk-selection-limitSellerCreate` |
| L3 | 업체 제한 상세 | `buy-mydesk-selection-limitSellerDetail.html` | `buy-mydesk-selection-limitSellerDetail` |
| L3 | 공급업체 이용제한 목록 | `buy-mydesk-selection-limitSellerList.html` | `buy-mydesk-selection-limitSellerList` |
| └ 팝업 | 수의시담 요청 취소 | `buy-mydesk-selection-negoCancelPopup.html` | `buy-mydesk-selection-negoCancelPopup` |
| L3 | 수의시담 목록 | `buy-mydesk-selection-negoList.html` | `buy-mydesk-selection-negoList` |
| └ 팝업 | 안내공고 취소 팝업 | `buy-mydesk-selection-postingCancelPopup.html` | `buy-mydesk-selection-postingCancelPopup` |
| L3 | 견적조회(안내공고) | `buy-mydesk-selection-postingCompare.html` | `buy-mydesk-selection-postingCompare` |
| L3 | 안내공고 신규등록 | `buy-mydesk-selection-postingRenewCreate.html` | `buy-mydesk-selection-postingRenewCreate` |
| └ 팝업 | 계약상대자 취소 팝업 | `buy-mydesk-selection-postingSellerSelectCancelPopup.html` | `buy-mydesk-selection-postingSellerSelectCancelPopup` |
| └ 팝업 | 계약상대자 지정 팝업 | `buy-mydesk-selection-postingSellerSelectPopup.html` | `buy-mydesk-selection-postingSellerSelectPopup` |
| └ 팝업 | 안내공고 정정 팝업 | `buy-mydesk-selection-postingUpdatePopup.html` | `buy-mydesk-selection-postingUpdatePopup` |
| L3 | 견적요청 | `buy-mydesk-selection-quoteNegoCreate.html` | `buy-mydesk-selection-quoteNegoCreate` |
| L3 | 견적요청 | `buy-mydesk-selection-quoteNegoDetail.html` | `buy-mydesk-selection-quoteNegoDetail` |

#### 13.12 연계정보관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 발주계획 목록 (S2B) | `buy-mydesk-receipt-budgetS2BList.html` | `buy-mydesk-receipt-budgetS2BList` | <!-- 260510-WAVE2-ATOMIC-SPLIT -->
| L3 | 발주계획 목록 (에듀파인) | `buy-mydesk-receipt-budgetEdufineList.html` | `buy-mydesk-receipt-budgetEdufineList` |
| L3 | 발주계획 등록 (마이데스크) | `buy-mydesk-receipt-budgetCreate.html` | `buy-mydesk-receipt-budgetCreate` |
| L3 | 상세 | `buy-mydesk-receipt-budgetDetail.html` | `buy-mydesk-receipt-budgetDetail` |
| L3 | 발주계획 목록 에듀파인 | `buy-mydesk-receipt-budgetEdulineList.html` | `buy-mydesk-receipt-budgetEdulineList` |
| L3 | 1인수의 견적정보 사업담당자 계약요청 목록(가칭) | `buy-mydesk-receipt-catalogCartCheck.html` | `buy-mydesk-receipt-catalogCartCheck` |
| L3 | 에듀파인 품의정보 상세 | `buy-mydesk-receipt-edufineApprovalDetail.html` | `buy-mydesk-receipt-edufineApprovalDetail` |
| L3 | 에듀파인 품의정보 목록 | `buy-mydesk-receipt-edufineApprovalList.html` | `buy-mydesk-receipt-edufineApprovalList` |
| L3 | 에듀파인 연계정보 상세 | `buy-mydesk-receipt-edufineInterfaceDetail.html` | `buy-mydesk-receipt-edufineInterfaceDetail` |
| L3 | 목록 | `buy-mydesk-receipt-edufineInterfaceList.html` | `buy-mydesk-receipt-edufineInterfaceList` |
| L3 | 에듀파인 연계해제 | `buy-receipt-edufineInterfaceUnlink.html` | `buy-receipt-edufineInterfaceUnlink` |
| L3 | 사전규격 목록 (S2B) | `buy-mydesk-receipt-prespecS2BList.html` | `buy-mydesk-receipt-prespecS2BList` | <!-- 260510-WAVE2-ATOMIC-SPLIT -->
| L3 | 사전규격 목록 (에듀파인) | `buy-mydesk-receipt-prespecEdufineList.html` | `buy-mydesk-receipt-prespecEdufineList` |
| L3 | 사전규격 등록 | `buy-mydesk-receipt-prespecCreate.html` | `buy-mydesk-receipt-prespecCreate` |
| L3 | 상세 | `buy-mydesk-receipt-prespecDetail.html` | `buy-mydesk-receipt-prespecDetail` |
| L3 | 사전규격 목록 에듀파인 | `buy-mydesk-receipt-prespecEdulineList.html` | `buy-mydesk-receipt-prespecEdulineList` |
| L3 | 사전규격 공급업체 의견 상세 | `buy-mydesk-receipt-prespecSellerOpinionDetail.html` | `buy-mydesk-receipt-prespecSellerOpinionDetail` |
| └ 팝업 | 조합추천 취소사유 팝업 | `buy-receipt-smppCancelPopup.html` | `buy-receipt-smppCancelPopup` |
| L3 | 조합추천 수의계약 등록 | `buy-receipt-smppCreate.html` | `buy-receipt-smppCreate` |
| L3 | 조합추천 수의계약 정보 상세 | `buy-mydesk-receipt-smppDetail.html` | `buy-mydesk-receipt-smppDetail` |
| L3 | 조합추천 수의계약 정보 목록 | `buy-mydesk-receipt-smpplist.html` | `buy-mydesk-receipt-smpplist` |
| └ 팝업 | 조합 검색 팝업 | `buy-receipt-smppUnionSearchPopup.html` | `buy-receipt-smppUnionSearchPopup` |
| └ 팝업 | 중소기업자간 경쟁제품 검색 팝업 | `buy-receipt-smppSmallSellerSearchPopup.html` | `buy-receipt-smppSmallSellerSearchPopup` |

#### 13.13 이용자그룹관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 이용자 그룹 등록 | `buy-mydesk-group-create.html` | `buy-mydesk-group-create` |
| L3 | 기관관리자 권한 요청 | `buy-mydesk-master-requestCreate.html` | `buy-mydesk-master-requestCreate` |
| L3 | 관리자 권한 요청 상세 | `buy-mydesk-master-requestDetail.html` | `buy-mydesk-master-requestDetail` |
| L3 | 기관관리자 권한 요청 완료 | `buy-mydesk-master-requestDone.html` | `buy-mydesk-master-requestDone` |
| L3 | 관리자 권한 요청 접수함 | `buy-mydesk-master-requestList.html` | `buy-mydesk-master-requestList` |
| └ 팝업 | 로그인 팝업 | `buy-mydesk-member-loginPopup.html` | `buy-mydesk-member-loginPopup` |
| L3 | 기관정보수정 | `buy-mydesk-member-profileUpdate.html` | `buy-mydesk-member-profileUpdate` |
| L3 | 본인 권한 조회 | `buy-mydesk-permission-myStatus.html` | `buy-mydesk-permission-myStatus` |
| L3 | 이용자 권한 요청 | `buy-mydesk-permission-requestCreate.html` | `buy-mydesk-permission-requestCreate` |

#### 13.14 입찰/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 입찰 상세 (마이데스크) | `buy-mydesk-bid-bidDetailOrderApplyTab.html` | `buy-mydesk-bid-bidDetailOrderApplyTab` |
| L3 | 입찰 등록 | `buy-mydesk-bid-bidCreate.html` | `buy-mydesk-bid-bidCreate` |
| └ 팝업 | 입찰 상세 조회 팝업 | `buy-mydesk-bid-bidDetailPopup.html` | `buy-mydesk-bid-bidDetailPopup` |
| L3 | 낙찰자결정방법 설정 팝업 | `buy-mydesk-bid-screeningMethod.html` | `buy-mydesk-bid-screeningMethod` |

#### 13.15 정산관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 이용수수료 정산 | `buy-mydesk-settlement-payFee.html` | `buy-mydesk-settlement-payFee` |
| L3 | 이용수수료 상세내역 | `buy-mydesk-settlement-payFeeDetail.html` | `buy-mydesk-settlement-payFeeDetail` |
| L3 | 이용수수료 환불/면제 신청 공고 팝업 | `buy-mydesk-settlement-refundFee.html` | `buy-mydesk-settlement-refundFee` |
| L3 | 이용수수료 환불 요청 승인 | `buy-mydesk-settlement-refundFeeReqAp.html` | `buy-mydesk-settlement-refundFeeReqAp` |
| L3 | 이용수수료 환불/면제 신청 상세 | `buy-mydesk-settlement-refundFeeReqDetail.html` | `buy-mydesk-settlement-refundFeeReqDetail` |
| L3 | 이용수수료 환불/면제 신청 목록 | `buy-mydesk-settlement-refundFeeReqList.html` | `buy-mydesk-settlement-refundFeeReqList` |
| L3 | 이용수수료 환불/면제 신청 작성 팝업 | `buy-mydesk-settlement-refundFeeReqPop.html` | `buy-mydesk-settlement-refundFeeReqPop` |
| L3 | 이용수수료 환불 요청 | `buy-mydesk-settlement-refundFeeRequest.html` | `buy-mydesk-settlement-refundFeeRequest` |
| L3 | 이용수수료 환불 요청 상세 | `buy-mydesk-settlement-refundFeeRequestDetail.html` | `buy-mydesk-settlement-refundFeeRequestDetail` |
| L3 | 이용수수료 선불 요청 | `buy-mydesk-settlement-requestFeeBill.html` | `buy-mydesk-settlement-requestFeeBill` |
| L3 | 이용수수료 선발행 요청 목록 | `buy-mydesk-settlement-requestFeeBillList.html` | `buy-mydesk-settlement-requestFeeBillList` |
| L3 | 이용수수료 세금계산서 | `buy-mydesk-settlement-taxStampList.html` | `buy-mydesk-settlement-taxStampList` |
| L3 | 이용수수료 선발행 신청 | `buy-mydesk-settlement-taxTemplateList.html` | `buy-mydesk-settlement-taxTemplateList` |

#### 13.16 장바구니/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 내 견적서 접수목록 | `buy-mydesk-cart-cartList.html` | `buy-mydesk-cart-cartList` |
| └ 팝업 | 견적서 접수목록 생성 | `buy-mydesk-cart-cartCreatePopup.html` | `buy-mydesk-cart-cartCreatePopup` |
| └ 팝업 | 템플릿 불러오기 | `buy-mydesk-cart-cartTemplateLoadPopup.html` | `buy-mydesk-cart-cartTemplateLoadPopup` |
| L2 | 과거 구매요청 이력 | `buy-mydesk-cart-requestHistory.html` | `buy-mydesk-cart-requestHistory` |

> 폐기(2026-05-22, `_legacy/마이데스크/장바구니/`): `cartDetail`, `cartCompare`, `cartCopyPopup`, `cartTemplateSavePopup`, `itemMovePopup`, `memoPopup`, `rereceiptSearchPopup`

> Phase A (장바구니 관리 핵심). Phase B(보내기·받기·구매요청·반려·계약방법변경)는 후속 계획.

---

## 14. 에러페이지

? 폴더: `수요자포털/` (포털 루트)

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 공통 에러 페이지 | `buy-error-page.html` | `buy-error-page` |

---
