# 관리자포털 TO-BE IA (표 형식)

> AS-IS 1Depth 18개 골격(불변) + 매핑된 TO-BE 폴더 안 화면을 표 형식으로 정리.
> 9.전시관리는 사용자 확정 IA 시안 (admin-catalog-* 새 ID 체계). 그 외는 현재 작업물 기반 자동 정리.
> 깊이 라벨: L2(1Depth 직속) · L3(서브폴더) · L4(서브의 서브) · `└ 팝업`/`└ 모달`/`└ tab`(파일명 패턴).

## 1. 메인

? 폴더: `관리자포털/메인/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 관리자 대시보드 | `admin-main-main.html` | `admin-main-main` |

---

## 2. 시스템관리

? 폴더: `관리자포털/시스템관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 마이페이지 | `admin-main-mypage.html` | `admin-main-mypage` |
| L2 | 관리자메뉴 | `admin-system-adminMenu.html` | `admin-system-adminMenu` |
| L2 | 운영자 동반정보 상세 | `admin-system-member-memberDetail-affiliation.html` | `admin-system-member-memberDetailCompanion` |
| L2 | 공급업체포털 메뉴관리 | `admin-system-sellMenu.html` | `admin-system-sellMenu` |
| L2 | 운영자 추가 | `admin-system-userAdd.html` | `admin-system-userAdd` |
| L2 | 본인확인 처리 | `admin-system-userConfirmcheck.html` | `admin-system-userConfirmcheck` |
| L2 | 운영자 삭제 | `admin-system-userDelete.html` | `admin-system-userDelete` |
| L2 | 운영자 정보 (alias) | `admin-system-userInfo.html` | `admin-system-userInfo` |
| L2 | 소속정보 관리 | `admin-system-userInfouseInfoAffiliation.html` | `admin-system-userInfouseInfoAffiliation` |
| L2 | 운영자 접속이력 | `admin-system-userLog.html` | `admin-system-userLog` |
| L2 | 접근권한 관리 | `admin-system-userPermissionCreate_권한그룹등록.html` | `admin-system-userPermissionCreate_권한그룹등록` |
| L2 | 접근권한 관리 | `admin-system-userPermissioncreate.html` | `admin-system-userPermissioncreate` |

#### 2.1 공통코드관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공통코드 관리 | `admin-system-commonCode.html` | `admin-system-commonCode` |
| L3 | 공통코드 관리 | `S2B-ADM-CF-001_공통코드관리.html` | `S2B-ADM-CF-001_공통코드관리` |
| L3 | 시스템 설정 | `S2B-ADM-CF-004_시스템설정.html` | `S2B-ADM-CF-004_시스템설정` |

#### 2.2 메뉴관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 관리자포털 메뉴관리 | `admin-system-adminMenu.html` | `admin-system-adminMenu` |
| L3 | 공급업체포털 메뉴관리 | `admin-system-sellMenu.html` | `admin-system-sellMenu` |
| L3 | 수요기관포털 메뉴관리 | `admin-system-buyMenu.html` | `admin-system-buyMenu` |

#### 2.3 시스템이용도우미/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 시스템 이용 도우미 | `S2B-ADM-CF-003_시스템이용도우미.html` | `S2B-ADM-CF-003_시스템이용도우미` |

#### 2.4 이용자관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 운영자 추가 (팝업) | `admin-system-userAdd_운영자추가.html` | `admin-system-userAdd_운영자추가` |
| L3 | 운영자 승인관리 | `admin-system-userApproval_운영자승인관리.html` | `admin-system-userApproval_운영자승인관리` |
| L3 | 운영자정보 변경이력 (팝업) | `admin-system-userChangehistory.html` | `admin-system-userChangehistory` |
| L3 | 운영자승인 관리 | `admin-system-userConfirmlist.html` | `admin-system-userConfirmlist` |
| L3 | 운영자 삭제 | `admin-system-userDelete_운영자삭제.html` | `admin-system-userDelete_운영자삭제` |
| └ 팝업 | 운영자정보 변경이력 (팝업) | `admin-system-userHistory_변경이력팝업.html` | `admin-system-userHistory_변경이력팝업` |
| L3 | 소속정보 등록 | `admin-system-userInfoadd.html` | `admin-system-userInfoadd` |
| L3 | 소속정보 관리 | `admin-system-userInformation.html` | `admin-system-userInformation` |
| L3 | 운영자정보 관리 | `admin-system-userInfoSetting_운영자정보관리.html` | `admin-system-userInfoSetting_운영자정보관리` |
| L3 | 접근권한 관리 | `admin-system-userPermission_접근권한관리.html` | `admin-system-userPermission_접근권한관리` |

---

## 3. 기준정보관리

? 폴더: `관리자포털/기준정보관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 입찰 배점심사 관리 | `admin-masterdata-bidEvalSetting.html` | `admin-masterdata-bidEvalSetting` |
| L2 | 입찰 참여조건 관리 | `admin-masterdata-bidRule.html` | `admin-masterdata-bidRule` |
| L2 | 입찰 참여조건 변경이력 | `admin-masterdata-bidRuleHistory.html` | `admin-masterdata-bidRuleHistory` |
| L2 | 계약 보증금율 관리 | `admin-masterdata-bondRateSetting.html` | `admin-masterdata-bondRateSetting` |
| L2 | 계약구분 조달금액 현황 | `admin-masterdata-contractCap.html` | `admin-masterdata-contractCap` |
| L2 | 계약카테고리 관리 | `admin-masterdata-contractCategory.html` | `admin-masterdata-contractCategory` |
| L2 | 기업인증 조달금액 관리 | `admin-masterdata-corpCap.html` | `admin-masterdata-corpCap` |
| L2 | 견적서 제출 필수조건 관리 | `admin-masterdata-draftRuleSetting.html` | `admin-masterdata-draftRuleSetting` |
| L2 | 계약 공고기간 관리 | `admin-masterdata-durationSetting-goods.html` | `admin-masterdata-durationSetting` |
| L2 | 이용수수료 현황 | `admin-masterdata-feeCurrent.html` | `admin-masterdata-feeCurrent` |
| L2 | 이용수수료 변경이력 | `admin-masterdata-fee-quote.html` | `admin-masterdata-feeList` |
| L2 | 이용수수료 결제방법 관리 | `admin-masterdata-feeOption.html` | `admin-masterdata-feeOption` |
| L2 | 서식통합 관리 | `admin-masterdata-formSetting.html` | `admin-masterdata-formSetting` |
| L2 | 물품인증 조달금액 현황 | `admin-masterdata-itemCap.html` | `admin-masterdata-itemCap` |
| L2 | 고시금액 현황 | `admin-masterdata-limitAmount.html` | `admin-masterdata-limitAmount` |
| L2 | 복수예가 관리 | `admin-masterdata-metric.html` | `admin-masterdata-metric` |
| L2 | 공휴일 정보 관리 | `admin-masterdata-offdaySetting.html` | `admin-masterdata-offdaySetting` |
| L2 | 결제방법 관리 | `admin-masterdata-paymentOption.html` | `admin-masterdata-paymentOption` |
| L2 | 안내공고(2인수의) 참여조건 관리 | `admin-masterdata-postingRule.html` | `admin-masterdata-postingRule` |
| L2 | 안내공고 참여조건 변경이력 | `admin-masterdata-postingRuleHistory.html` | `admin-masterdata-postingRuleHistory` |
| L2 | 상담카테고리 관리 | `admin-masterdata-vocCategory.html` | `admin-masterdata-vocCategory` |

---

## 4. 수요기관관리

? 폴더: `관리자포털/수요기관관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 수요기관 활동 정보 | `admin-member-buyApprovalaction.html` | `admin-member-buyApprovalaction` |
| L2 | 수요기관 상세 (승인완료) | `admin-member-buyApprovallogdetail-page1.html` | `admin-member-buyApprovallogdetail` |
| L2 | 수요기관 소속 이용자 조회 목록 | `admin-member-buyApprovalLoguserList.html` | `admin-member-buyApprovalLoguserList` |
| └ 팝업 | 수요기관 이용자 조회 팝업 | `admin-member-buyApprovalLoguserpopup.html` | `admin-member-buyApprovalLoguserpopup` |
| L2 | 수요기관 승인완료 관리 목록 | `admin-member-buyApprovalOKList.html` | `admin-member-buyApprovalOKList` |
| └ 팝업 | 수요기관 반려 팝업 | `admin-member-buyApprovalpopup.html` | `admin-member-buyApprovalpopup` |
| L2 | 수요기관 이용자 목록 | `admin-member-buyApprovaluserlist.html` | `admin-member-buyApprovaluserlist` |
| └ 팝업 | 수요기관 이용자 상세 팝업 | `admin-member-buyApprovaluserpopup.html` | `admin-member-buyApprovaluserpopup` |
| L2 | 나이스코드 목록 | `admin-member-buyNicecodeList.html` | `admin-member-buyNicecodeList` |
| L2 | S2B 기관코드 발급 팝업 | `admin-member-buyS2Bcode.html` | `admin-member-buyS2Bcode` |
| L2 | 수요기관 이용자 통합 조회 | `admin-member-buyUserSearch.html` | `admin-member-buyUserSearch` |
| L2 | 수요기관 정보 변경 이력 | `admin-member-buyUserUpdateHistory.html` | `admin-member-buyUserUpdateHistory` |

#### 4.1 승인대상관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 수요기관 관리 목록 | `_legacy/.../admin-member-buyApproval2List.html` (폐기→UM-011로 통합) | `admin-member-buyApproval2List` |
| L3 | 수요기관 관리 목록 | `S2B-ADM-UM-011_수요기관관리목록.html` | `S2B-ADM-UM-011_수요기관관리목록` |
| L3 | 수요기관 관리 상세 | `S2B-ADM-UM-011D_수요기관관리상세.html` | `S2B-ADM-UM-011D_수요기관관리상세` |

#### 4.2 신규승인관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 수요기관 신규승인 상세 | `admin-member-buyApprovalDetail.html` | `admin-member-buyApprovalDetail` |
| L3 | 수요기관 신규승인 관리 | `admin-member-buyApprovalList.html` | `admin-member-buyApprovalList` |

#### 4.3 S2B기관코드생성요청승인관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | S2B 기관코드생성요청 상세 | `admin-member-tempS2BCreatedetail_S2B기관코드생성요청상세.html` | `admin-member-tempS2BCreatedetail_S2B기관코드생성요청상세` |
| L3 | S2B 기관코드생성요청 목록 | `admin-member-tempS2BCreatelist_S2B기관코드생성요청목록.html` | `admin-member-tempS2BCreatelist_S2B기관코드생성요청목록` |

---

## 5. 공급업체관리

? 폴더: `관리자포털/공급업체관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 수요기관 평가 상세 | `admin-member-buyerRatingDetail.html` | `admin-member-buyerRatingDetail` |
| L2 | 수요기관 평가 목록 | `admin-member-buyerRatingList.html` | `admin-member-buyerRatingList` |
| L2 | 공급업체 이용제한 이의신청 상세 | `admin-member-limitSellerClaimDetail.html` | `admin-member-limitSellerClaimDetail` |
| L2 | 공급업체 이용제한 이의신청 목록 | `admin-member-limitSellerClaimList.html` | `admin-member-limitSellerClaimList` |
| └ 팝업 | 공급업체 계약 이력 조회 팝업 | `admin-member-limitSellerContractlistpopup.html` | `admin-member-limitSellerContractlistpopup` |
| └ 팝업 | 이용제한 대상 공급업체 조회 팝업 | `admin-member-limitSellersuppliselistpopup.html` | `admin-member-limitSellersuppliselistpopup` |
| └ 팝업 | 공급업체 이용제한 처분 등록 팝업 | `admin-member-LimitSelleruppPopup.html` | `admin-member-LimitSelleruppPopup` |
| L2 | 반려목록 | `admin-member-rejectionList.html` | `admin-member-rejectionList` |
| └ 팝업 | 평가/리뷰 이의신청 등록 팝업 | `admin-member-reviewClaimCreatePopup.html` | `admin-member-reviewClaimCreatePopup` |
| L2 | 평가/리뷰 이의신청 목록 | `admin-member-reviewClaimList.html` | `admin-member-reviewClaimList` |
| └ 팝업 | 공급업체 평가/등급 상세 팝업 | `admin-member-reviewDetailPopup.html` | `admin-member-reviewDetailPopup` |
| L2 | 공급업체 평가 종합 | `admin-member-reviewList.html` | `admin-member-reviewList` |
| L2 | 납품불량정보 | `admin-member-defectiveDeliveryList.html` | `admin-member-defectiveDeliveryList` |
| L2 | 공급업체 신규승인 관리 목록 | `admin-member-sellApprovalList.html` | `admin-member-sellApprovalList` |
| └ 팝업 | 공급업체 반려 팝업 | `admin-member-sellApprovalpopup.html` | `admin-member-sellApprovalpopup` |
| L2 | 공급업체 리뷰 상세 | `admin-member-sellerReviewDetail.html` | `admin-member-sellerReviewDetail` |
| L2 | 공급업체 리뷰 목록 | `admin-member-sellerReviewList.html` | `admin-member-sellerReviewList` |

#### 5.1 승인대상관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공급업체 승인 상세 | `admin-member-limitSellerDetail.html` | `admin-member-limitSellerDetail` |
| L3 | 공급업체 신규 승인 신청 관리 | `admin-member-limitSellerList.html` | `admin-member-limitSellerList` |
| L3 | 공급업체 승인목록 | `admin-member-selApprovalList.html` | `admin-member-selApprovalList` |
| L3 | 공급업체 승인 상세 | `admin-member-sellApprovalDetail.html` | `admin-member-sellApprovalDetail` |
| L3 | 공급업체 승인목록 | `admin-member-sellApprovallog_공급업체승인목록.html` | `admin-member-sellApprovallog_공급업체승인목록` |
| L3 | 공급업체 신규 승인 신청 관리 | `S2B-ADM-UM-010_공급업체관리목록.html` | `S2B-ADM-UM-010_공급업체관리목록` |

---

## 6. 연계관리

? 폴더: `관리자포털/연계관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 물품선정위원회 관리 목록 | `S2B-ADM-LK-001_물품선정위원회목록.html` | `S2B-ADM-LK-001_물품선정위원회목록` |
| L2 | 물품선정위원회 회차 상세 | `S2B-ADM-LK-002_물품선정위원회상세.html` | `S2B-ADM-LK-002_물품선정위원회상세` |

---

## 7. 계약관리

? 폴더: `관리자포털/계약관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 입찰 상세 | `admin-contract-bidDetailOrderApplyTab.html` | `admin-contract-bidDetailOrderApplyTab` |
| L2 | 계약체결 탭 | `admin-contract-bidDetailExecutionTab.html` | `admin-contract-bidDetailExecutionTab` |
| L2 | 검수 탭 | `admin-contract-bidDetailInspectionTab.html` | `admin-contract-bidDetailInspectionTab` |
| L2 | 계약접수 탭 | `admin-contract-bidDetailOrderApplyTab.html` | `admin-contract-bidDetailOrderApplyTab` |
| L2 | 업체선정 탭 | `admin-contract-bidDetailSelectionTab.html` | `admin-contract-bidDetailSelectionTab` |
| L2 | 문서함 탭 | `admin-contract-bidInboxDetail.html` | `admin-contract-bidInboxDetail` |
| L2 | 입찰공고 인쇄 (관리자) | `admin-contract-bidNoticeSamplePrint.html` | `admin-contract-bidNoticeSamplePrint` |
| L2 | 결제 탭 | `admin-contract-bidPaymentTab.html` | `admin-contract-bidPaymentTab` |
| L2 | 1인수의 견적정보 계약 상세 | `admin-contract-catalogDetailSelectionTab.html` | `admin-contract-catalogDetailSelectionTab` |
| L2 | 계약체결 탭 | `admin-contract-catalogDetailExecutionTab.html` | `admin-contract-catalogDetailExecutionTab` |
| L2 | 문서함 탭 | `admin-contract-catalogDetailInboxDetail.html` | `admin-contract-catalogDetailInboxDetail` |
| L2 | 검수 탭 | `admin-contract-catalogDetailInspectionTab.html` | `admin-contract-catalogDetailInspectionTab` |
| L2 | 결제 탭 | `admin-contract-catalogDetailPaymentTab.html` | `admin-contract-catalogDetailPaymentTab` |
| L2 | 업체선정 탭 | `admin-contract-catalogDetailSelectionTab.html` | `admin-contract-catalogDetailSelectionTab` |
| L2 | 2024학년도 부산가상중학교 노트북 및 주변기기 납품 견적요청 | `admin-contract-edufineApprovalDetail.html` | `admin-contract-edufineApprovalDetail` |
| L2 | 2024학년도 부산가상중학교 노트북 및 주변기기 납품 견적요청 | `admin-contract-edufineApprovalList.html` | `admin-contract-edufineApprovalList` |
| L2 | 2024학년도 부산가상중학교 노트북 및 주변기기 납품 견적요청 | `admin-contract-edufineInterfaceDetail.html` | `admin-contract-edufineInterfaceDetail` |
| L2 | 2024학년도 부산가상중학교 노트북 및 주변기기 납품 견적요청 | `admin-contract-edufineInterfaceList.html` | `admin-contract-edufineInterfaceList` |
| L2 | 2인수의 안내공고 상세 | `admin-contract-postingDetailOrderApplyTab.html` | `admin-contract-postingDetailOrderApplyTab` |
| L2 | 계약체결 탭 | `admin-contract-postingDetailExecutionTab.html` | `admin-contract-postingDetailExecutionTab` |
| L2 | 문서함 탭 | `admin-contract-postingDetailInboxDetail.html` | `admin-contract-postingDetailInboxDetail` |
| L2 | 검수 탭 | `admin-contract-postingDetailInspectionTab.html` | `admin-contract-postingDetailInspectionTab` |
| L2 | 계약접수 탭 | `admin-contract-postingDetailOrderApplyTab.html` | `admin-contract-postingDetailOrderApplyTab` |
| L2 | 결제 탭 | `admin-contract-postingDetailPaymentTab.html` | `admin-contract-postingDetailPaymentTab` |
| L2 | 업체선정 탭 | `admin-contract-postingDetailSelectionTab.html` | `admin-contract-postingDetailSelectionTab` |
| L2 | 2인수의 안내공고 인쇄 (관리자) | `admin-contract-postingNoticeSamplePrint.html` | `admin-contract-postingNoticeSamplePrint` |
| L2 | 1인수의 견적요청 상세 | `admin-contract-quoteDetailOrderApplyTab.html` | `admin-contract-quoteDetailOrderApplyTab` |
| L2 | 계약체결 탭 | `admin-contract-quoteDetailExecutionTab.html` | `admin-contract-quoteDetailExecutionTab` |
| L2 | 문서함 탭 | `admin-contract-quoteDetailInboxDetail.html` | `admin-contract-quoteDetailInboxDetail` |
| L2 | 검수 탭 | `admin-contract-quoteDetailInspectionTab.html` | `admin-contract-quoteDetailInspectionTab` |
| L2 | 계약접수 탭 | `admin-contract-quoteDetailOrderApplyTab.html` | `admin-contract-quoteDetailOrderApplyTab` |
| L2 | 결제 탭 | `admin-contract-quoteDetailPaymentTab.html` | `admin-contract-quoteDetailPaymentTab` |
| L2 | 업체선정 탭 | `admin-contract-quoteDetailSelectionTab.html` | `admin-contract-quoteDetailSelectionTab` |
| L2 | 2024학년도 부산가상중학교 노트북 및 주변기기 납품 견적요청 | `admin-contract-smppDetail.html` | `admin-contract-smppDetail` |
| L2 | 2024학년도 부산가상중학교 노트북 및 주변기기 납품 견적요청 | `admin-contract-smppList.html` | `admin-contract-smppList` |

#### 7.1 검수관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 검수현황 목록 | `S2B-ADM-IS-001_검수현황목록.html` | `S2B-ADM-IS-001_검수현황목록` |
| L3 | 검수현황 상세 | `S2B-ADM-IS-002_검수현황상세.html` | `S2B-ADM-IS-002_검수현황상세` |
| L3 | 미검수 관리 | `S2B-ADM-IS-003_미검수관리.html` | `S2B-ADM-IS-003_미검수관리` |

#### 7.2 계약승인/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약승인 목록 | `S2B-ADM-CT-003_계약승인목록.html` | `S2B-ADM-CT-003_계약승인목록` |
| L3 | 계약승인 상세 | `S2B-ADM-CT-004_계약승인상세.html` | `S2B-ADM-CT-004_계약승인상세` |

#### 7.3 계약현황/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 계약현황 목록 | `admin-contract-contractList.html` | `admin-contract-contractList` |
| L3 | 계약현황 목록 | `S2B-ADM-CT-001_계약현황목록.html` | `S2B-ADM-CT-001_계약현황목록` |
| L3 | 계약현황 상세 | `S2B-ADM-CT-002_계약현황상세.html` | `S2B-ADM-CT-002_계약현황상세` |

---

## 8. 견적정보관리

? 폴더: `관리자포털/견적정보관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 승인상세 | `admin-catalog-approvalDetail.html` | `admin-catalog-approvalDetail` |
| L2 | 승인목록 | `admin-catalog-approvalList.html` | `admin-catalog-approvalList` |
| L2 | 배너 | `admin-catalog-Banner.html` | `admin-catalog-Banner` |
| L2 | 견적정보브랜드목록 | `admin-catalog-catalogBrandList.html` | `admin-catalog-catalogBrandList` |
| L2 | 견적정보상세 | `admin-catalog-catalogErrorDetail.html` | `admin-catalog-catalogErrorDetail` |
| L2 | 견적정보제조사목록 | `admin-catalog-catalogMakerList.html` | `admin-catalog-catalogMakerList` |
| └ tab | 인증정보탭 | `admin-catalog-certinfo-tab.html` | `admin-catalog-certinfo-tab` |
| └ 팝업 | 공공구매연계정보 상세 | `admin-catalog-certInfoCreatePopup.html` | `admin-catalog-certInfoCreatePopup` |
| L2 | 공공구매연계정보 목록 | `admin-catalog-certInfoList.html` | `admin-catalog-certInfoList` |
| └ 팝업 | 조회팝업 | `admin-catalog-certinfoViewPopup.html` | `admin-catalog-certinfoViewPopup` |
| L2 | 전시상세 | `admin-catalog-displayAreaDetail.html` | `admin-catalog-displayAreaDetail` |
| L2 | 전시목록 | `admin-catalog-displayAreaList.html` | `admin-catalog-displayAreaList` |
| L2 | 전시카테고리조회 | `admin-catalog-displayCategoryView.html` | `admin-catalog-displayCategoryView` |
| └ 팝업 | 가입카테고리조회팝업 | `admin-display-JoinCategoryViewPopup.html` | `admin-display-JoinCategoryViewPopup` |
| └ 팝업 | 전시카테고리 조회 팝업 (연계) | `admin-catalog-JsonCategoryViewPopup.html` | `admin-catalog-JsonCategoryViewPopup` |
| └ 팝업 | 등록팝업 | `admin-catalog-keywordCreatePopup.html` | `admin-catalog-keywordCreatePopup` |
| └ tab | 키워드정보탭 | `admin-catalog-keywordInfo-tab.html` | `admin-catalog-keywordInfo-tab` |
| L2 | 상품속성정보 이력관리 | `admin-catalog-offerPriceHistory.html` | `admin-catalog-offerPriceHistory` |
| └ tab | 옵션정보탭 | `admin-catalog-option-tab.html` | `admin-catalog-option-tab` |
| └ 팝업 | 팝업 | `admin-catalog-Popup.html` | `admin-catalog-Popup` |
| └ 팝업 | 상품공시 조회 | `admin-catalog-productInfocViewPopup.html` | `admin-catalog-productInfocViewPopup` |
| └ 팝업 | 상품정보공지조회팝업 | `admin-catalog-productInfoNoticeViewPopup.html` | `admin-catalog-productInfoNoticeViewPopup` |
| └ tab | 기본카테고리 관리 | `admin-catalog-productProperty-tab_certInfo-tab_option-tab_keywordInfo-tab.html` | `admin-catalog-productProperty-tab_certInfo-tab_option-tab_keywordInfo-tab` |
| └ 팝업 | 상품등록팝업 | `admin-catalog-productPropertyCreatePopup.html` | `admin-catalog-productPropertyCreatePopup` |
| └ 팝업 | 상품조회팝업 | `admin-catalog-productPropertyViewPopup.html` | `admin-catalog-productPropertyViewPopup` |
| L2 | 프로모션목록 | `admin-catalog-promotionList.html` | `admin-catalog-promotionList` |
| L2 | 프로모션템플릿 | `admin-catalog-promotionTemplate.html` | `admin-catalog-promotionTemplate` |
| L2 | 목록 | `admin-catalog-ProviderdailyregistList.html` | `admin-catalog-ProviderdailyregistList` |
| L2 | 업체별 이력 현황 | `admin-catalog-ProviderdailyrequestList.html` | `admin-catalog-ProviderdailyrequestList` |
| L2 (요청건수 제한관리) | 업체별 요청 현황 목록 | `요청건수제한관리/admin-catalog-ProviderRequestList.html` | `admin-catalog-ProviderRequestList` |
| └ 팝업 | 업체별 요청 상세 팝업 | `요청건수제한관리/admin-catalog-ProviderRequestDetailPopup.html` | `admin-catalog-ProviderRequestDetailPopup` |
| └ 팝업 | 일간 업체별 물품등록 요청 현황 팝업 | `요청건수제한관리/admin-catalog-ProviderDailyRequestPopup.html` | `admin-catalog-ProviderDailyRequestPopup` |
| L2 (요청건수 제한관리) | 요청건수제한관리 목록 | `요청건수제한관리/admin-catalog-RequestLimitList.html` | `admin-catalog-RequestLimitList` |
| └ 팝업 | 요청건수제한 상세 팝업 | `요청건수제한관리/admin-catalog-RequestLimitDetailPopup.html` | `admin-catalog-RequestLimitDetailPopup` |

#### 8.1 견적정보관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 견적정보 관리 목록 | `admin-catalog-catalogErrorList.html` | `admin-catalog-catalogErrorList` |
| L3 | 카테고리 관리 | `admin-catalog-StandardCategoryView.html` | `admin-catalog-StandardCategoryView` |
| L3 | 카테고리 관리 | `S2B-ADM-PD-003_카테고리관리.html` | `S2B-ADM-PD-003_카테고리관리` |
| L3 | 제시금액이력관리 | `admin-catalog-offerPriceHistory.html` | `admin-catalog-offerPriceHistory` |

#### 8.2 견적정보승인/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 견적정보 승인 | `S2B-ADM-PD-005_견적정보승인.html` | `S2B-ADM-PD-005_견적정보승인` |

#### 8.3 물품등록관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 인증정보 등록 팝업 | `admin-catalog-certinfoCreatePopup.html` | `admin-catalog-certinfoCreatePopup` |
| L3 | 인증정보 목록 | `admin-catalog-certinfoList.html` | `admin-catalog-certinfoList` |
| L3 | 물품등록 승인 목록 | `S2B-ADM-PD-001_물품등록승인목록.html` | `S2B-ADM-PD-001_물품등록승인목록` |
| L3 | 물품등록 승인 상세 | `S2B-ADM-PD-002_물품등록승인상세.html` | `S2B-ADM-PD-002_물품등록승인상세` |

#### 8.4 카테고리관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | admin-catalog-displamallInfoList 전시몰 정보 관리 (전시금액이력관리) | `admin-catalog-displamallInfoList_전시몰정보관리.html` | `admin-catalog-displamallInfoList_전시몰정보관리` |
| L3 | 제시금액이력관리 | `admin-catalog-offerPriceHistory_제시금액이력관리.html` | `admin-catalog-offerPriceHistory_제시금액이력관리` |
| L3 | 상품속성정보 목록 | `admin-catalog-productPropertyList.html` | `admin-catalog-productPropertyList` |
| L3 | 옵션관리 | `admin-catalog-optionManage.html` | `admin-catalog-optionManage` |

#### 8.5 품질검사/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 품질검사 관리 | `S2B-ADM-PD-006_품질검사관리.html` | `S2B-ADM-PD-006_품질검사관리` |

---

## 9. 전시관리 ? TO-BE 구조안

? 패키지: catalog (AS-IS 동일) / 폴더: `관리자포털/전시관리/`

### 9.1 몰관리 ? `몰관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 몰 관리 목록 | `mall-list.html` | `admin-catalog-mallList` |

? 등록·수정은 목록 내 인라인 또는 모달(`mall-edit-modal`)로 처리. 별도 파일 미생성.

---

### 9.2 템플릿/코너 관리 ? `템플릿코너관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 전시 템플릿 관리 | `template-list.html` | `admin-catalog-templateList` |
| └ 모달 | 전시 템플릿 수정 | (목록 내장) | `admin-catalog-templateEditModal` |
| L3 | 전시 코너 관리 | `corner-list.html` | `admin-catalog-cornerList` |
| └ 모달 | 전시 코너 등록·수정·상세 | (목록 내장) | `admin-catalog-cornerFormModal` |

? 모달은 별도 HTML 파일로 분리하지 않고 부모 목록 내 토글 영역으로 작성 (와이어프레임 표준).

---

### 9.3 전시 연결 관리 ? `전시연결관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 전시매장 연결 관리 | `shop-link-list.html` | `admin-catalog-shopLinkList` |
| └ 팝업 | 템플릿 추가 | (목록 내장) | `admin-catalog-shopLinkTemplateAddPopup` |
| └ 팝업 | 코너 상세 (텍스트/이미지/HTML/기획전 물품 tab) | (목록 내장) | `admin-catalog-shopLinkCornerDetailPopup` |
| L3 | 팝업 정보 관리 | `popup-info-list.html` | `admin-catalog-popupInfoList` |
| └ 팝업 | 팝업 정보 등록 | (목록 내장) | `admin-catalog-popupInfoCreatePopup` |

? 코너 상세 팝업은 4탭 구성 (텍스트 / 이미지 / HTML / 기획전 물품).

---

### 9.4 기획전 관리 ? `기획전관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 기획전 목록 | `promotion-list.html` | `admin-catalog-promotionList` |
| L4 | 기획전 상세 (4 tab) | `promotion-detail.html` | `admin-catalog-promotionDetail` |
| └ tab | 기본정보 | (탭 영역) | `admin-catalog-promotionDetail-basicTab` |
| └ tab | 구분자 | (탭 영역) | `admin-catalog-promotionDetail-classifierTab` |
| └ tab | 물품 정보 | (탭 영역) | `admin-catalog-promotionDetail-itemTab` |
| └ tab | 모집/참여 관리 | (탭 영역) | `admin-catalog-promotionDetail-recruitTab` |
| L4 | 기획전 등록 (4 tab) | `promotion-create.html` | `admin-catalog-promotionCreate` |
| └ tab | 기본정보·구분자·물품·모집/참여 | (탭 영역) | `admin-catalog-promotionCreate-{basic,classifier,item,recruit}Tab` |
| L3 | 기획전 그룹 관리 | `promotion-group-list.html` | `admin-catalog-promotionGroupList` |

? 통계 화면(몰 통계 / 기획전 통계)은 **11. 통계관리**로 이동 예정.

---

## 10. 정산관리

? 폴더: `관리자포털/정산관리/` + `관리자포털/결제관리/`

### 10.1 정산관리/

? 260515-SETTLEMENT-LNB-REBUILD: LNB를 `이용수수료관리(12)` + `인지세관리(2)` 구조로 전면 교체.
모달(팝업)은 LNB 비노출 ? 호출화면 본문 버튼에서만 진입. 매출정산/ 4파일은 파일은 보존하되 LNB 비노출.

#### 10.1.A 이용수수료관리/

| 깊이 | 화면명 | 파일 | 화면 ID | 요구사항 | 비고 |
| --- | --- | --- | --- | --- | --- |
| L3 | 미발행 이용수수료 세금계산서 (그룹) | ? | ? | REQ-SFR-038-001 | 4depth 묶음 |
| └ L4 | 미발행 이용수수료 세금계산서 목록 | `admin-settlement-PreTax.html` | `admin-settlement-PreTax` | REQ-SFR-038-001 |  |
| └ L4 | 미발행 이용수수료 세금계산서 상세내역 | `admin-settlement-PreTaxDetail.html` | `admin-settlement-PreTaxDetail` | REQ-SFR-038-001 |  |
| └ 팝업 | 미발행 이용수수료 세금계산서 발행팝업 | `admin-settlement-PreTaxDetailPopup.html` | `admin-settlement-PreTaxDetailPopup` | REQ-SFR-038-001 | 모달 |
| └ 팝업 | 발행제외 관리 | `admin-settlement-PreTaxExcludePopup.html` | `admin-settlement-PreTaxExcludePopup` | REQ-SFR-038-001 | 모달, **신규 placeholder** |
| L3 | 발행 이용수수료 세금계산서 (그룹) | ? | ? | REQ-SFR-038-003 | 4depth 묶음 |
| └ L4 | 발행 이용수수료 세금계산서 목록 | `세금계산서/admin-settlement-Tax.html` | `admin-settlement-Tax` | REQ-SFR-038-001 |  |
| └ L4 | 발행 이용수수료 세금계산서 상세내역 | `세금계산서/admin-settlement-TaxDetail.html` | `admin-settlement-TaxDetail` | REQ-SFR-038-003 |  |
| └ 팝업 | 발행 이용수수료 세금계산서 수정팝업 | `세금계산서/admin-settlement-TaxPopup.html` | `admin-settlement-TaxPopup` | REQ-SFR-038-003 | 모달, **신규 placeholder** |
| └ 팝업 | 입금등록 | `세금계산서/admin-settlement-TaxIncomePopup.html` | `admin-settlement-TaxIncomePopup` | REQ-SFR-038-003 | 모달, **신규 placeholder** |
| L3 | PG결제 이용수수료 (그룹) | ? | ? | REQ-SFR-038-005 | 4depth 묶음 |
| └ L4 | PG결제 이용수수료 | `admin-settlement-BuyIncome.html` | `admin-settlement-BuyIncome` | REQ-SFR-038-005 |  |
| └ 팝업 | PG결제 이용수수료 승인취소 사유 입력 | `admin-settlement-BuyincomeCancelPopup.html` | `admin-settlement-BuyincomeCancelPopup` | REQ-SFR-038-005 | 모달 |
| └ 팝업 | PG결제 이용수수료 상세 | `admin-settlement-BuyincomeDetailPopup.html` | `admin-settlement-BuyincomeDetailPopup` | REQ-SFR-038-005 | 모달 |
| L3 | 이용수수료 환불신청 (그룹) | ? | ? | REQ-SFR-039-002 / -003 / -004 | 4depth 묶음 |
| └ L4 | 이용수수료 환불 신청현황 목록/상세 | `환불관리/admin-settlement-feeRefund.html` | `admin-settlement-feeRefund` | REQ-SFR-039-002 / -003 | 좌목록+우상세 1page |
| └ 팝업 | 이용수수료 환불 신청현황_환불선택 | `환불관리/admin-settlement-feeRefundPopup.html` | `admin-settlement-feeRefundPopup` | REQ-SFR-039-002 / -004 | 모달 |
| └ L4 | 수요기관 환불공문 입력 | `환불관리/admin-settlement-sellRefundDoc.html` | `admin-settlement-sellRefundDoc` | REQ-SFR-039-004 |  |
| └ L4 | 환불공문 조회 | `환불관리/admin-settlement-SellRefundDocView.html` | `admin-settlement-SellRefundDocView` | REQ-SFR-039-004 | **신규 placeholder** |
| L3 | 발행제외 관리 | `admin-settlement-ExceptBill.html` | `admin-settlement-ExceptBill` | REQ-SFR-039-002 |  |
| L3 | 발행일정 관리 | `수수료관리/admin-settlement-feeBillSchedule.html` | `admin-settlement-feeBillSchedule` | REQ-SFR-038-001 |  |
| L3 | 수요기관 입금내역 | `admin-settlement-SellIncome.html` | `admin-settlement-SellIncome` | REQ-SFR-038-005 |  |
| L3 | 가상계좌관리 | `가상계좌/admin-settlement-virtualAccount.html` | `admin-settlement-virtualAccount` | REQ-SFR-038-005 |  |
| L3 | 선발행 요청현황조회 | `admin-settlement-requestPreBill.html` | `admin-settlement-requestPreBill` | REQ-SFR-038-004 |  |
| L3 | 세금계산서 발행내역 (그룹) | ? | ? | REQ-SFR-038-005 | 4depth 묶음 |
| └ L4 | 세금계산서 발행내역 목록 | `admin-settlement-TaxBill.html` | `admin-settlement-TaxBill` | REQ-SFR-038-005 |  |
| └ L4 | 세금계산서 발행내역 상세 | `admin-settlement-TaxBillDetail.html` | `admin-settlement-TaxBillDetail` | REQ-SFR-038-005 | **신규 placeholder** |
| L3 | 공급업체 결제금액 지급현황 | `admin-settlement-SellPayment.html` | `admin-settlement-SellPayment` | REQ-SFR-037-003 | **신규 placeholder** |

#### 10.1.B 인지세관리/

| 깊이 | 화면명 | 파일 | 화면 ID | 요구사항 | 비고 |
| --- | --- | --- | --- | --- | --- |
| L3 | 수요기관 납부현황 | `admin-settlement-PreTaxBuy.html` | `admin-settlement-PreTaxBuy` | (미기재) | **신규 placeholder**, PreTaxSell과 대칭 |
| L3 | 공급업체 납부현황 | `admin-settlement-PreTaxSell.html` | `admin-settlement-PreTaxSell` |  |  |

#### 10.1.C LNB 비노출 (파일 보존)

| 분류 | 파일 | 화면 ID | 비고 |
| --- | --- | --- | --- |
| 매출정산/ | `매출정산/S2B-ADM-ST-001_정산대시보드.html` | `S2B-ADM-ST-001_정산대시보드` | 260515 신규 LNB에서 빠짐 (파일 보존) |
| 매출정산/ | `매출정산/S2B-ADM-ST-002_매출정산목록.html` | `S2B-ADM-ST-002_매출정산목록` | 동상 |
| 매출정산/ | `매출정산/S2B-ADM-ST-003_매출정산상세.html` | `S2B-ADM-ST-003_매출정산상세` | 동상 |
| 매출정산/ | `매출정산/S2B-ADM-ST-004_정산마감처리.html` | `S2B-ADM-ST-004_정산마감처리` | 동상 |
| 임시발행 | `admin-settlement-buyTaxTempList.html` | `admin-settlement-buyTaxTempList` | 신규 LNB에 없음, 파일만 보존 |
| 임시발행 | `admin-settlement-sellTaxTempList.html` | `admin-settlement-sellTaxTempList` | 동상 |
| 이동안내 | `admin-settlement-sellRefundDoc.html` (정산관리/ 루트) | `admin-settlement-sellRefundDoc` | SSOT19로 환불관리/로 이동, 안내 placeholder |
| 이동안내 | `admin-settlement-feeRefundDoc.html` (정산관리/ 루트) | `admin-settlement-feeRefundDoc` | 동상 |
| 폐지 | `환불관리/admin-settlement-feeRefundDoc.html` | `admin-settlement-feeRefundDoc` | 260515 폐지 placeholder (SellRefundDocView로 통합) |
| 통합안내 | `환불관리/admin-settlement-feeRefundDetail.html` | `admin-settlement-feeRefundDetail` | SSOT19 통합안내 placeholder, 신규 LNB에 없음 |
| 구버전 | `세금계산서/S2B-ADM-ST-008_세금계산서발행목록.html` | `S2B-ADM-ST-008_세금계산서발행목록` | 신규 LNB는 admin-settlement-* 라인 사용 |
| 구버전 | `세금계산서/S2B-ADM-ST-009_세금계산서발행상세.html` | `S2B-ADM-ST-009_세금계산서발행상세` | 동상 |
| 구버전 | `수수료관리/S2B-ADM-ST-005_이용수수료부과목록.html` | `S2B-ADM-ST-005_이용수수료부과목록` | 동상 |
| 구버전 | `수수료관리/S2B-ADM-ST-006_이용수수료부과상세.html` | `S2B-ADM-ST-006_이용수수료부과상세` | 동상 |
| 구버전 | `수수료관리/S2B-ADM-ST-007_수수료율설정.html` | `S2B-ADM-ST-007_수수료율설정` | 동상 |
| 구버전 | `환불관리/S2B-ADM-ST-010_환불관리목록.html` | `S2B-ADM-ST-010_환불관리목록` | 동상 |
| 구버전 | `환불관리/S2B-ADM-ST-011_환불처리상세.html` | `S2B-ADM-ST-011_환불처리상세` | 동상 |
| 구버전 | `환불관리/S2B-ADM-ST-013_감면관리.html` | `S2B-ADM-ST-013_감면관리` | 동상 |
| 구버전 | `가상계좌/S2B-ADM-ST-012_가상계좌관리.html` | `S2B-ADM-ST-012_가상계좌관리` | 동상 |

### 10.2 결제관리/

#### 10.2.1 PG거래/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 결제현황 목록 | `admin-payment-pgTransaction.html` | `admin-payment-pgTransaction` |
| L3 | 결제현황 목록 | `S2B-ADM-PAY-001_결제현황목록.html` | `S2B-ADM-PAY-001_결제현황목록` |
| L3 | 결제현황 상세 | `S2B-ADM-PAY-002_결제현황상세.html` | `S2B-ADM-PAY-002_결제현황상세` |
| L3 | 지급승인 처리 | `S2B-ADM-PAY-003_지급승인처리.html` | `S2B-ADM-PAY-003_지급승인처리` |

---

## 11. 통계관리

? 폴더: `관리자포털/통계관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 수요기관 이용현황 통계 | `admin-report-buyState.html` | `admin-report-buyState` |
| L2 | 견적정보통계 관리통계 | `admin-report-catalogManageStat.html` | `admin-report-catalogManageStat` |
| L2 | S2B 물품 판매 현황 통계 | `admin-report-catalogSellStat.html` | `admin-report-catalogSellStat` |
| L2 | 견적정보통계 (복합) | `admin-report-catalogStat.html` | `admin-report-catalogStat` |
| L2 | 중복투찰 통계 | `admin-report-doubleBidStat.html` | `admin-report-doubleBidStat` |
| L2 | 이용수수료 청구현황 | `admin-report-feeBilling.html` | `admin-report-feeBilling` |
| L2 | 이용수수료 통계 | `admin-report-feeStat.html` | `admin-report-feeStat` |
| L2 | 운영 실적 | `admin-report-kpi.html` | `admin-report-kpi` |
| L2 | 이용수수료 현황 통계 (복합) | `admin-report-orderStat.html` | `admin-report-orderStat` |
| L2 | 기획전 상품통계 | `admin-report-promotionStat.html` | `admin-report-promotionStat` |
| L2 | 공공구매 현황 통계 | `admin-report-publicBuyList.html` | `admin-report-publicBuyList` |
| L2 | 지역별 통계 | `admin-report-regionStat.html` | `admin-report-regionStat` |
| L2 | 운영통계리포트 | `admin-report-signup.html` | `admin-report-signup` |
| L2 | GA 트래킹 통계 | `admin-report-trackingGA.html` | `admin-report-trackingGA` |
| L2 | 부문별 운영실적 통계 | `admin-report-unitState.html` | `admin-report-unitState` |
| L2 | VOC 성능통계 (복합) | `admin-report-vocState.html` | `admin-report-vocState` |
| L2 | 거래통계 리포트 | `S2B-ADM-RPT-001_거래통계리포트.html` | `S2B-ADM-RPT-001_거래통계리포트` |
| L2 | 이용자 통계 | `S2B-ADM-RPT-002_이용자통계.html` | `S2B-ADM-RPT-002_이용자통계` |
| L2 | 정산 리포트 | `S2B-ADM-RPT-003_정산리포트.html` | `S2B-ADM-RPT-003_정산리포트` |

---

## 12. VOC관리

? 폴더: `관리자포털/VOC관리/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 상담 워크스페이스 | `admin-member-vocConsole.html` | `admin-member-vocConsole` |
| L2 | VOC 관리 | `admin-member-vocList.html` | `admin-member-vocList` |
| L2 | SMS 이력관리 | `admin-member-smsHistory.html` | `admin-member-smsHistory` |
| L2 | ARS 안내멘트 관리 | `admin-member-arsMessage.html` | `admin-member-arsMessage` |
| L2 | 이관 내역 | `admin-member-vocTransferList.html` | `admin-member-vocTransferList` |

---

## 13. 알림/커뮤니케이션

? 폴더: `관리자포털/알림커뮤니케이션/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 금칙어 관리 | `admin-display-bannedSetting.html` | `admin-display-bannedSetting` |
| L2 | 커뮤니티 게시글 목록 | `admin-notification-communityList.html` | `admin-notification-communityList` |
| L2 | 커뮤니티 공지 목록 | `admin-notification-communityNoticeList.html` | `admin-notification-communityNoticeList` |
| L2 | 이벤트 관리 목록 | `admin-notification-eventList.html` | `admin-notification-eventList` |
| L2 | 이벤트 등록/수정 | `admin-notification-eventForm.html` | `admin-notification-eventForm` |
| L2 | 이벤트 상세 - 이벤트 정보 | `admin-notification-eventDetailEventInfoTab.html` | `admin-notification-eventDetailEventInfoTab` |
| L2 | 이벤트 상세 - 신청현황 | `admin-notification-eventDetailEventStatusTab.html` | `admin-notification-eventDetailEventStatusTab` |
| L2 | 이벤트 상세 - 당첨자관리 | `admin-notification-eventDetailEventManageTab.html` | `admin-notification-eventDetailEventManageTab` |
| L2 | 이벤트 상세 - 이벤트결과 | `admin-notification-eventDetailEventResultTab.html` | `admin-notification-eventDetailEventResultTab` |
| L2 | 메일링 발송 관리 | `admin-notification-mailing.html` | `admin-notification-mailing` |
| L2 | 메일 템플릿 관리 | `admin-notification-mailingTemplate.html` | `admin-notification-mailingTemplate` |
| L2 | 메시지 목록 | `admin-notification-messageList.html` | `admin-notification-messageList` |
| L2 | 신조어 관리 | `admin-display-neologismSetting.html` | `admin-display-neologismSetting` |
| L2 | SMS/푸시 템플릿 관리 | `admin-notification-pushTemplate.html` | `admin-notification-pushTemplate` |
| L2 | 추천 검색어 관리 | `admin-display-suggestSetting.html` | `admin-display-suggestSetting` |
| L2 | 동의어 관리 | `admin-display-synonymSetting.html` | `admin-display-synonymSetting` |
| L2 | 테스터 목록 | `admin-notification-testerList.html` | `admin-notification-testerList` |
| L2 | 인기 검색어 제외 관리 | `admin-display-trendingSetting.html` | `admin-display-trendingSetting` |

#### 13.1 검색관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 통합검색어 목록 관리 | `admin-display-searchList.html` | `admin-display-searchList` |
| L3 | 금칙어 관리 | `admin-display-bannedSetting.html` | `admin-display-bannedSetting` |
| L3 | 동의어 관리 | `admin-display-synonymSetting.html` | `admin-display-synonymSetting` |
| L3 | 신조어 관리 | `admin-display-neologismSetting.html` | `admin-display-neologismSetting` |
| L3 | 인기 검색어 제외 관리 | `admin-display-trendingSetting.html` | `admin-display-trendingSetting` |
| L3 | 추천 검색어 관리 | `admin-display-suggestSetting.html` | `admin-display-suggestSetting` |
| L3 | 추천 검색어 등록 | `SRC-ADM-012.html` | `SRC-ADM-012` |
| L3 | 검색 가중치 관리 | `admin-display-searchTuneSetting.html` | `admin-display-searchTuneSetting` |
<!-- 260507-PHJ: SRC-ADM-XXX → admin-notification-* 화면ID/파일명 변경. SRC-ADM-002는 001(searchList)로 통합 폐지. SRC-ADM-012는 rename 대상 외 -->


#### 13.2 알림공통/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | SMS/푸시/메일관리 | `admin-notification-pushList.html` | `admin-notification-pushList` |
| L3 | 알림 공통 설정 | `S2B-ADM-CM-001_알림공통설정.html` | `S2B-ADM-CM-001_알림공통설정` |
| L3 | 알림 템플릿 관리 | `S2B-ADM-CM-002_알림템플릿관리.html` | `S2B-ADM-CM-002_알림템플릿관리` |

#### 13.3 알림관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 게시글 관리 | `CMT-ADM-001.html` | `CMT-ADM-001` |
| L3 | 금칙어 관리 | `CMT-ADM-002.html` | `CMT-ADM-002` |
| L3 | 신고 관리 대시보드 | `CMT-ADM-003.html` | `CMT-ADM-003` |

---

## 14. 고객지원

? 폴더: `관리자포털/고객지원/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 홍보자료실 등록 | `admin-support-32bResourcesCreate.html` | `admin-support-32bResourcesCreate` |
| L2 | 홍보자료실 상세 | `admin-support-32bResourcesDetail.html` | `admin-support-32bResourcesDetail` |
| L2 | 홍보자료실 목록 | `admin-support-32bResourcesList.html` | `admin-support-32bResourcesList` |
| L2 | 우수기관등록 | `admin-support-awardCreate.html` | `admin-support-awardCreate` |
| L2 | 우수기관상세 | `admin-support-awardDetail.html` | `admin-support-awardDetail` |
| L2 | 우수기관목록 | `admin-support-awardList.html` | `admin-support-awardList` |
| L2 | 등록 | `admin-support-brochureCreate.html` | `admin-support-brochureCreate` |
| L2 | 상세 | `admin-support-brochureDetail.html` | `admin-support-brochureDetail` |
| L2 | 목록 | `admin-support-brochureList.html` | `admin-support-brochureList` |
| └ 팝업 | 팝업 | `admin-support-buy-popup.html` | `admin-support-buy-popup` |
| L2 | 목록(캘린더형) | `admin-support-buytrainingCalendar.html` | `admin-support-buytrainingCalendar` |
| └ tab | 수요기관 교육연수 상세 | `admin-support-buytrainingDetail-tab1.html` | `admin-support-buytrainingDetail-tab1` |
| └ tab | admin-support-buytrainingDetail-tab1 | `admin-support-buytrainingDetail-tab1.html` | `admin-support-buytrainingDetail-tab1` |
| └ tab | admin-support-buytrainingDetail-tab2 | `admin-support-buytrainingDetail-tab2.html` | `admin-support-buytrainingDetail-tab2` |
| └ tab | admin-support-buytrainingDetail-tab3 | `admin-support-buytrainingDetail-tab3.html` | `admin-support-buytrainingDetail-tab3` |
| └ tab | 교육만족도평가 탭 | `admin-support-buytrainingDetail-tab4.html` | `admin-support-buytrainingDetail-tab4` |
| L2 | 목록 | `admin-support-buytrainingList.html` | `admin-support-buytrainingList` |
| └ 팝업 | 팝업 | `admin-support-buytrainingReturn-popup.html` | `admin-support-buytrainingReturn-popup` |
| └ 팝업 | 팝업 | `admin-support-buytrainingStateDetail-popup.html` | `admin-support-buytrainingStateDetail-popup` |
| L2 | 수요기관 방문교육신청 목록 | `admin-support-buytrainingVisitList.html` | `admin-support-buytrainingVisitList` |
| L2 | 목록(캘린더형) | `admin-support-buytrainingVisitCalendar.html` | `admin-support-buytrainingVisitCalendar` |
| └ tab | 수요기관 방문교육신청 상세 | `admin-support-buytrainingVisitDetail-tab1.html` | `admin-support-buytrainingVisitDetail-tab1` |
| └ tab | admin-support-buytrainingVisitDetail-tab1 | `admin-support-buytrainingVisitDetail-tab1.html` | `admin-support-buytrainingVisitDetail-tab1` |
| └ tab | admin-support-buytrainingVisitDetail-tab2 | `admin-support-buytrainingVisitDetail-tab2.html` | `admin-support-buytrainingVisitDetail-tab2` |
| └ tab | admin-support-buytrainingVisitDetail-tab3 | `admin-support-buytrainingVisitDetail-tab3.html` | `admin-support-buytrainingVisitDetail-tab3` |
| L2 | 목록 | `admin-support-buytrainingVisitList.html` | `admin-support-buytrainingVisitList` |
| └ 팝업 | 팝업 | `admin-support-buytrainingVisitRequest-popup.html` | `admin-support-buytrainingVisitRequest-popup` |
| L2 | 등록 | `admin-support-campaignCreate.html` | `admin-support-campaignCreate` |
| L2 | 상세 | `admin-support-campaignDetail.html` | `admin-support-campaignDetail` |
| L2 | 목록 | `admin-support-campaignList.html` | `admin-support-campaignList` |
| L2 | 자료실 서식 목록 | `admin-support-formResourcesList.html` | `admin-support-formResourcesList` |
| L2 | 용어사전 관리 등록 | `admin-support-dictionaryCreate.html` | `admin-support-dictionaryCreate` |
| L2 | 용어사전상세 | `admin-support-dictionaryDetail.html` | `admin-support-dictionaryDetail` |
| L2 | 등록 | `admin-support-legalResourcesCreate.html` | `admin-support-legalResourcesCreate` |
| L2 | 상세 | `admin-support-legalResourcesDetail.html` | `admin-support-legalResourcesDetail` |
| L2 | 목록 | `admin-support-legalResourcesList.html` | `admin-support-legalResourcesList` |
| L2 | S2B주요행사 관리 등록 | `admin-support-mainEventCreate.html` | `admin-support-mainEventCreate` |
| L2 | S2B주요행사 관리 상세 | `admin-support-mainEventDetail.html` | `admin-support-mainEventDetail` |
| L2 | S2B주요행사 관리 목록 | `admin-support-mainEventList.html` | `admin-support-mainEventList` |
| L2 | 온라인매뉴얼 관리 | `admin-support-manual.html` | `admin-support-manual` |
| L2 | 등록 | `admin-support-mediaCreate.html` | `admin-support-mediaCreate` |
| L2 | 상세 | `admin-support-mediaDetail.html` | `admin-support-mediaDetail` |
| L2 | 목록 | `admin-support-mediaList.html` | `admin-support-mediaList` |
| L2 | 상세 | `admin-support-newsroomDetail.html` | `admin-support-newsroomDetail` |
| L2 | 수정등록 | `admin-support-newsroomEditCreate.html` | `admin-support-newsroomEditCreate` |
| L2 | 수정상세 | `admin-support-newsroomEditDetail.html` | `admin-support-newsroomEditDetail` |
| L2 | 등록 | `admin-support-newsroomURLCreate.html` | `admin-support-newsroomURLCreate` |
| L2 | admin-support-newsroomURLlist | `admin-support-newsroomURLlist.html` | `admin-support-newsroomURLlist` |
| L2 | 변경이력 | `admin-support-policyHistory.html` | `admin-support-policyHistory` |
| L2 | 이용약관 관리 | `admin-support-policyList.html` | `admin-support-policyList` |
| L2 | 상세 | `admin-support-s2bResourcesDetail.html` | `admin-support-s2bResourcesDetail` |
| └ 팝업 | 팝업 | `admin-support-sell-popup.html` | `admin-support-sell-popup` |
| └ tab | admin-support-selltrainingDetail-tab2 | `admin-support-selltrainingDetail-tab2.html` | `admin-support-selltrainingDetail-tab2` |
| └ tab | admin-support-selltrainingDetail-tab3 | `admin-support-selltrainingDetail-tab3.html` | `admin-support-selltrainingDetail-tab3` |
| └ tab | 교육만족도평가 탭 | `admin-support-selltrainingDetail-tab4.html` | `admin-support-selltrainingDetail-tab4` |
| L2 | 목록 | `admin-support-selltrainingList.html` | `admin-support-selltrainingList` |
| └ 팝업 | 팝업 | `admin-support-selltrainingReturn-popup.html` | `admin-support-selltrainingReturn-popup` |
| └ 팝업 | 팝업 | `admin-support-selltrainingStateDetail-popup.html` | `admin-support-selltrainingStateDetail-popup` |
| L2 | 공급업체 교육연수 목록 | `admin-support-selltrainingVisitList.html` | `admin-support-selltrainingVisitList` |
| L2 | 목록(캘린더형) | `admin-support-selltrainingVisitCalendar.html` | `admin-support-selltrainingVisitCalendar` |
| └ tab | 공급업체 방문교육신청 상세 | `admin-support-selltrainingVisitDetail-tab1.html` | `admin-support-selltrainingVisitDetail-tab1` |
| └ 팝업 | 팝업 | `admin-support-selltrainingVisitRequest-popup.html` | `admin-support-selltrainingVisitRequest-popup` |
| L2 | 등록 | `admin-support-termsCreate.html` | `admin-support-termsCreate` |
| L2 | 상세 | `admin-support-termsDetail.html` | `admin-support-termsDetail` |
| L2 | admin-support-trial | `admin-support-trial.html` | `admin-support-trial` |

#### 14.1 1대1문의관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 1대1문의 답변 등록 | `admin-support-askDetail.html` | `admin-support-askDetail` |
| L3 | 1대1문의 관리 목록 | `admin-support-askList.html` | `admin-support-askList` |
| L3 | 1대1문의 관리 목록 | `S2B-ADM-CS-001_1대1문의관리목록.html` | `S2B-ADM-CS-001_1대1문의관리목록` |
| L3 | 1대1문의 답변 등록 | `S2B-ADM-CS-002_1대1문의답변등록.html` | `S2B-ADM-CS-002_1대1문의답변등록` |

#### 14.2 공지사항관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 공지사항 등록 | `admin-support-noticeCreate.html` | `admin-support-noticeCreate` |
| L3 | 공지사항 상세 | `admin-support-noticeDetail.html` | `admin-support-noticeDetail` |
| L3 | 공지사항 관리 목록 | `admin-support-noticeList.html` | `admin-support-noticeList` |

#### 14.3 교육연수관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 수요기관 교육연수 목록 | `admin-support-buytrainingList.html` | `admin-support-buytrainingList` |
| L3 | 교육연수 등록 | `admin-support-buytrainingCreate.html` | `admin-support-buytrainingCreate` |
| L3 | 교육연수 신청관리 | `admin-support-trainingApplyManage.html` | `admin-support-trainingApplyManage` |
| L3 | 교육연수 신청현황 | `admin-support-trainingApplyStatus.html` | `admin-support-trainingApplyStatus` |
| L3 | 교육연수 방명록 | `admin-support-trainingGuestbook.html` | `admin-support-trainingGuestbook` |
| L3 | 교육연수 연수결과 | `admin-support-trainingResult.html` | `admin-support-trainingResult` |
| L3 | 교육연수 관리 목록 | `S2B-ADM-CS-007_교육연수관리목록.html` | `S2B-ADM-CS-007_교육연수관리목록` |
| L3 | 교육연수 등록 | `S2B-ADM-CS-008_교육연수등록수정.html` | `S2B-ADM-CS-008_교육연수등록수정` |

#### 14.4 신고게시판관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 신고게시판 목록 | `S2B-ADM-CS-REP-001_신고게시판목록.html` | `S2B-ADM-CS-REP-001_신고게시판목록` |
| L3 | 신고게시판 처리 상세 | `S2B-ADM-CS-REP-002_신고게시판상세.html` | `S2B-ADM-CS-REP-002_신고게시판상세` |

#### 14.5 약관통합관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 개인정보처리방침 | `admin-support-privacyPolicyList.html` | `admin-support-privacyPolicyList` |
| L3 | 약관 통합관리 | `admin-support-termsList.html` | `admin-support-termsList` |
| L3 | 약관 통합관리 | `S2B-ADM-CS-009_약관통합관리.html` | `S2B-ADM-CS-009_약관통합관리` |

#### 14.6 용어사전관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 용어사전 관리 | `admin-support-dictionary.html` | `admin-support-dictionary` |
| L3 | 용어사전 관리 | `S2B-ADM-DIC-001_용어사전관리.html` | `S2B-ADM-DIC-001_용어사전관리` |

#### 14.7 이달의우수기관관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | S2B이달의우수기관관리 | `admin-support-awardAmount.html` | `admin-support-awardAmount` |
| L3 | S2B이달의우수기관관리 | `admin-support-awardCount.html` | `admin-support-awardCount` |
| └ 팝업 | S2B이달의우수기관관리_데이터수집이력팝업 | `admin-support-awardhistorypopup.html` | `admin-support-awardhistorypopup` |

#### 14.8 자료실관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 자료실 수정 | `admin-support-s2bResourcesCreate.html` | `admin-support-s2bResourcesCreate` |
| L3 | 자료실 관리 목록 | `admin-support-s2bResourcesList.html` | `admin-support-s2bResourcesList` |
| L3 | 자료실 관리 목록 | `S2B-ADM-LIB-001_자료실관리목록.html` | `S2B-ADM-LIB-001_자료실관리목록` |
| L3 | 자료실 수정 | `S2B-ADM-LIB-002_자료실등록수정.html` | `S2B-ADM-LIB-002_자료실등록수정` |

#### 14.9 클린거래제보센터관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 견적정보 모니터링 상세 | `admin-support-cleandeal-catalogmonitoring-detail.html` | `admin-support-cleandeal-catalogmonitoring-detail` |
| L3 | 견적정보 모니터링 목록 | `admin-support-cleandeal-catalogmonitoring-list.html` | `admin-support-cleandeal-catalogmonitoring-list` |
| L3 | 규정위반신고 상세 | `admin-support-cleandeal-policyViolationtab-detail.html` | `admin-support-cleandeal-policyViolationtab-detail` |
| L3 | 규정위반신고 목록 | `admin-support-cleandeal-policyViolationtab-list.html` | `admin-support-cleandeal-policyViolationtab-list` |

#### 14.10 FAQ관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | FAQ 등록 | `admin-support-faqCreate.html` | `admin-support-faqCreate` |
| L3 | FAQ 상세 | `admin-support-faqDetail.html` | `admin-support-faqDetail` |
| L3 | FAQ 관리 목록 | `admin-support-faqList.html` | `admin-support-faqList` |
| L3 | FAQ관리목록 | `S2B-ADM-CS-003_FAQ관리목록.html` | `S2B-ADM-CS-003_FAQ관리목록` |
| L3 | FAQ등록수정 | `S2B-ADM-CS-004_FAQ등록수정.html` | `S2B-ADM-CS-004_FAQ등록수정` |

#### 14.11 PR센터관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | PR센터 관리 | `admin-support-newsroomList.html` | `admin-support-newsroomList` |
| L3 | PR센터 관리 | `S2B-ADM-PR-001-award.html` | `S2B-ADM-PR-001_PR센터관리` |

#### 14.12 S2B안내관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | CI 안내 | `admin-support-ciGuide.html` | `admin-support-ciGuide` |
| L3 | 연혁관리 등록 | `admin-support-historyCreate.html` | `admin-support-historyCreate` |
| L3 | 연혁관리 상세 | `admin-support-historyDetail.html` | `admin-support-historyDetail` |
| L3 | 연혁관리 | `admin-support-historyList.html` | `admin-support-historyList` |
| L3 | 찾아오는 길 | `admin-support-mapDirection.html` | `admin-support-mapDirection` |
| L3 | 지역센터 안내 | `admin-support-regionCenterList.html` | `admin-support-regionCenterList` |

#### 14.13 통합로그인서비스/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L3 | 통합로그인 수요기관 안내 | `admin-support-ssoBuyerGuide.html` | `admin-support-ssoBuyerGuide` |
| L3 | 통합로그인 인증서 안내 | `admin-support-ssoCertGuide.html` | `admin-support-ssoCertGuide` |
| L3 | 통합로그인 공급업체 안내 | `admin-support-ssoSupplierGuide.html` | `admin-support-ssoSupplierGuide` |

---

## 15. 로그인

? 폴더: `관리자포털/로그인/`

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 관리자 포털 | `admin-member-login.html` | `admin-member-login` |

---

## 16. 관리자

? 폴더: `관리자포털/운영자회원가입/` + `관리자포털/회원가입/`

### 16.1 운영자회원가입/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 약관동의 | `admin-member-agree.html` | `admin-member-agree` |
| L2 | 회원가입완료 | `admin-member-joined.html` | `admin-member-joined` |
| L2 | 회원승인 | `admin-member-memberApprove.html` | `admin-member-memberApprove` |

### 16.2 회원가입/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| └ 팝업 | 수요기관 | `admin-member-buyApprovalloguserpopup.html` | `admin-member-buyApprovalloguserpopup` |
| L2 | admin-member-newPassword | `admin-member-newPassword.html` | `admin-member-newPassword` |
| L2 | admin-member-resetPassword | `admin-member-resetPassword.html` | `admin-member-resetPassword` |
| L2 | 아이디 찾기 | `admin-member-searchId.html` | `admin-member-searchId` |
| L2 | 검색결과 | `admin-member-searchIDResult.html` | `admin-member-searchIDResult` |

---

## 17. 관리자정보관리

? 폴더: `관리자포털/이용자그룹관리/` + `관리자포털/이용자관리/` + `관리자포털/마이데스크/`

### 17.1 이용자그룹관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 목록 | `admin-member-groupList.html` | `admin-member-groupList` |
| L2 | 신규 관리자 지정 검토 | `admin-member-masterDesignate.html` | `admin-member-masterDesignate` |
| L2 | 사용 승인 처리 | `admin-member-useApproval.html` | `admin-member-useApproval` |

### 17.2 이용자관리/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 이용자 목록 조회 | `S2B-ADM-UM-012_개인이용자관리목록.html` | `S2B-ADM-UM-012_개인이용자관리목록` |
| L2 | 개인이용자정보 변경이력 | `S2B-ADM-UM-013_개인이용자정보변경이력.html` | `S2B-ADM-UM-013_개인이용자정보변경이력` |

### 17.3 마이데스크/

| 깊이 | 화면명 | 파일 | 화면 ID |
| --- | --- | --- | --- |
| L2 | 관리자 마이데스크 | `admin-main-mypage.html` | `admin-main-mypage` |

---

## 18. 카테고리관리

? _(매핑되는 TO-BE 폴더 없음 ? IA 정의 필요)_

---
