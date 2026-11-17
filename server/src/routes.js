// API 라우트 등록표. 문서 ID·이름은 server/docs/api/README.md 의 "전체 API 목록"과 같다.
// Express 는 등록 순서대로 경로를 맞춘다. 고정 경로(예: menus/order)를 같은 깊이의 :param 경로보다 먼저 둔다.
// route 파일은 src/api/<경로>/route.js 이다(폴더 이름 [x] = 경로 변수 :x).
import { Router } from "express";
import { expressRoute } from "#lib/express";
import * as admin__members from "./api/admin/members/route.js";
import * as admin__orders__orderId__cancel from "./api/admin/orders/[orderId]/cancel/route.js";
import * as admin__orders__orderId from "./api/admin/orders/[orderId]/route.js";
import * as admin__orders from "./api/admin/orders/route.js";
import * as admin__restrictions__restrictionId__release from "./api/admin/restrictions/[restrictionId]/release/route.js";
import * as admin__restrictions from "./api/admin/restrictions/route.js";
import * as admin__review_reports__reportId__process from "./api/admin/review-reports/[reportId]/process/route.js";
import * as admin__review_reports__reportId from "./api/admin/review-reports/[reportId]/route.js";
import * as admin__review_reports from "./api/admin/review-reports/route.js";
import * as admin__store_applications__applicationId__approve from "./api/admin/store-applications/[applicationId]/approve/route.js";
import * as admin__store_applications__applicationId__reject from "./api/admin/store-applications/[applicationId]/reject/route.js";
import * as admin__store_applications__applicationId from "./api/admin/store-applications/[applicationId]/route.js";
import * as admin__store_applications from "./api/admin/store-applications/route.js";
import * as admin__summary from "./api/admin/summary/route.js";
import * as auth__login from "./api/auth/login/route.js";
import * as auth__logout from "./api/auth/logout/route.js";
import * as auth__me from "./api/auth/me/route.js";
import * as auth__signup from "./api/auth/signup/route.js";
import * as customer__addresses__addressId__default from "./api/customer/addresses/[addressId]/default/route.js";
import * as customer__addresses__addressId from "./api/customer/addresses/[addressId]/route.js";
import * as customer__addresses from "./api/customer/addresses/route.js";
import * as customer__cart__items__cartItemId from "./api/customer/cart/items/[cartItemId]/route.js";
import * as customer__cart__items from "./api/customer/cart/items/route.js";
import * as customer__cart from "./api/customer/cart/route.js";
import * as customer__orders__orderId__cancel from "./api/customer/orders/[orderId]/cancel/route.js";
import * as customer__orders__orderId__review from "./api/customer/orders/[orderId]/review/route.js";
import * as customer__orders__orderId from "./api/customer/orders/[orderId]/route.js";
import * as customer__orders__preview from "./api/customer/orders/preview/route.js";
import * as customer__orders from "./api/customer/orders/route.js";
import * as customer__points__charges from "./api/customer/points/charges/route.js";
import * as customer__points from "./api/customer/points/route.js";
import * as customer__reviews__reviewId from "./api/customer/reviews/[reviewId]/route.js";
import * as customer__reviews from "./api/customer/reviews/route.js";
import * as customer__stores__storeId__menus__menuId from "./api/customer/stores/[storeId]/menus/[menuId]/route.js";
import * as customer__stores__storeId__menus from "./api/customer/stores/[storeId]/menus/route.js";
import * as customer__stores__storeId__reviews from "./api/customer/stores/[storeId]/reviews/route.js";
import * as customer__stores__storeId from "./api/customer/stores/[storeId]/route.js";
import * as customer__stores from "./api/customer/stores/route.js";
import * as owner__stores__storeId__application from "./api/owner/stores/[storeId]/application/route.js";
import * as owner__stores__storeId__hours from "./api/owner/stores/[storeId]/hours/route.js";
import * as owner__stores__storeId__menu_categories__categoryId from "./api/owner/stores/[storeId]/menu-categories/[categoryId]/route.js";
import * as owner__stores__storeId__menu_categories from "./api/owner/stores/[storeId]/menu-categories/route.js";
import * as owner__stores__storeId__menus__menuId__option_groups from "./api/owner/stores/[storeId]/menus/[menuId]/option-groups/route.js";
import * as owner__stores__storeId__menus__menuId from "./api/owner/stores/[storeId]/menus/[menuId]/route.js";
import * as owner__stores__storeId__menus__menuId__sale_status from "./api/owner/stores/[storeId]/menus/[menuId]/sale-status/route.js";
import * as owner__stores__storeId__menus__order from "./api/owner/stores/[storeId]/menus/order/route.js";
import * as owner__stores__storeId__menus from "./api/owner/stores/[storeId]/menus/route.js";
import * as owner__stores__storeId__oper_status from "./api/owner/stores/[storeId]/oper-status/route.js";
import * as owner__stores__storeId__option_groups__groupId__options from "./api/owner/stores/[storeId]/option-groups/[groupId]/options/route.js";
import * as owner__stores__storeId__option_groups__groupId from "./api/owner/stores/[storeId]/option-groups/[groupId]/route.js";
import * as owner__stores__storeId__options__optionId from "./api/owner/stores/[storeId]/options/[optionId]/route.js";
import * as owner__stores__storeId__orders__orderId__accept from "./api/owner/stores/[storeId]/orders/[orderId]/accept/route.js";
import * as owner__stores__storeId__orders__orderId__cancel from "./api/owner/stores/[storeId]/orders/[orderId]/cancel/route.js";
import * as owner__stores__storeId__orders__orderId__cooked from "./api/owner/stores/[storeId]/orders/[orderId]/cooked/route.js";
import * as owner__stores__storeId__orders__orderId__reject from "./api/owner/stores/[storeId]/orders/[orderId]/reject/route.js";
import * as owner__stores__storeId__orders__orderId from "./api/owner/stores/[storeId]/orders/[orderId]/route.js";
import * as owner__stores__storeId__orders from "./api/owner/stores/[storeId]/orders/route.js";
import * as owner__stores__storeId__reports from "./api/owner/stores/[storeId]/reports/route.js";
import * as owner__stores__storeId__reviews__reviewId__reply from "./api/owner/stores/[storeId]/reviews/[reviewId]/reply/route.js";
import * as owner__stores__storeId__reviews__reviewId__report from "./api/owner/stores/[storeId]/reviews/[reviewId]/report/route.js";
import * as owner__stores__storeId__reviews from "./api/owner/stores/[storeId]/reviews/route.js";
import * as owner__stores__storeId from "./api/owner/stores/[storeId]/route.js";
import * as owner__stores__storeId__sales__menus from "./api/owner/stores/[storeId]/sales/menus/route.js";
import * as owner__stores__storeId__sales from "./api/owner/stores/[storeId]/sales/route.js";
import * as owner__stores from "./api/owner/stores/route.js";
import * as rider__deliveries__deliveryId__accept from "./api/rider/deliveries/[deliveryId]/accept/route.js";
import * as rider__deliveries__deliveryId__complete from "./api/rider/deliveries/[deliveryId]/complete/route.js";
import * as rider__deliveries__deliveryId__pickup from "./api/rider/deliveries/[deliveryId]/pickup/route.js";
import * as rider__deliveries__current from "./api/rider/deliveries/current/route.js";
import * as rider__deliveries__history from "./api/rider/deliveries/history/route.js";
import * as rider__dispatch_requests from "./api/rider/dispatch-requests/route.js";
import * as rider__me from "./api/rider/me/route.js";

export const apiRouter = Router();

// X-14 회원 검색
apiRouter.get("/api/admin/members", expressRoute(admin__members.GET));
// X-11 주문 검색(고객센터)
apiRouter.get("/api/admin/orders", expressRoute(admin__orders.GET));
// X-12 주문 상세(고객센터)
apiRouter.get("/api/admin/orders/:orderId", expressRoute(admin__orders__orderId.GET));
// X-13 주문 취소(고객센터)
apiRouter.post("/api/admin/orders/:orderId/cancel", expressRoute(admin__orders__orderId__cancel.POST));
// X-08 리뷰 작성 제한 목록
apiRouter.get("/api/admin/restrictions", expressRoute(admin__restrictions.GET));
// X-09 리뷰 작성 제한
apiRouter.post("/api/admin/restrictions", expressRoute(admin__restrictions.POST));
// X-10 리뷰 작성 제한 해제
apiRouter.post("/api/admin/restrictions/:restrictionId/release", expressRoute(admin__restrictions__restrictionId__release.POST));
// X-05 리뷰 신고 목록
apiRouter.get("/api/admin/review-reports", expressRoute(admin__review_reports.GET));
// X-06 리뷰 신고 상세
apiRouter.get("/api/admin/review-reports/:reportId", expressRoute(admin__review_reports__reportId.GET));
// X-07 리뷰 신고 처리
apiRouter.post("/api/admin/review-reports/:reportId/process", expressRoute(admin__review_reports__reportId__process.POST));
// X-01 입점 신청 목록
apiRouter.get("/api/admin/store-applications", expressRoute(admin__store_applications.GET));
// X-02 입점 신청 상세
apiRouter.get("/api/admin/store-applications/:applicationId", expressRoute(admin__store_applications__applicationId.GET));
// X-03 입점 승인
apiRouter.post("/api/admin/store-applications/:applicationId/approve", expressRoute(admin__store_applications__applicationId__approve.POST));
// X-04 입점 반려
apiRouter.post("/api/admin/store-applications/:applicationId/reject", expressRoute(admin__store_applications__applicationId__reject.POST));
// X-00 관리자 요약
apiRouter.get("/api/admin/summary", expressRoute(admin__summary.GET));
// A-01 로그인
apiRouter.post("/api/auth/login", expressRoute(auth__login.POST));
// A-02 로그아웃
apiRouter.post("/api/auth/logout", expressRoute(auth__logout.POST));
// A-03 내 정보
apiRouter.get("/api/auth/me", expressRoute(auth__me.GET));
// A-08 내 정보 수정
apiRouter.patch("/api/auth/me", expressRoute(auth__me.PATCH));
// A-07 회원 탈퇴
apiRouter.delete("/api/auth/me", expressRoute(auth__me.DELETE));
// A-06 회원가입(CUSTOMER·OWNER) · D-01 라이더 회원가입
apiRouter.post("/api/auth/signup", expressRoute(auth__signup.POST));
// C-01 배달 주소 목록 조회
apiRouter.get("/api/customer/addresses", expressRoute(customer__addresses.GET));
// C-02 배달 주소 등록
apiRouter.post("/api/customer/addresses", expressRoute(customer__addresses.POST));
// C-03 배달 주소 수정
apiRouter.patch("/api/customer/addresses/:addressId", expressRoute(customer__addresses__addressId.PATCH));
// C-04 배달 주소 삭제
apiRouter.delete("/api/customer/addresses/:addressId", expressRoute(customer__addresses__addressId.DELETE));
// C-05 기본 배달 주소 지정
apiRouter.patch("/api/customer/addresses/:addressId/default", expressRoute(customer__addresses__addressId__default.PATCH));
// C-13 장바구니 조회
apiRouter.get("/api/customer/cart", expressRoute(customer__cart.GET));
// C-17 장바구니 전체 비우기
apiRouter.delete("/api/customer/cart", expressRoute(customer__cart.DELETE));
// C-14 장바구니 메뉴 담기
apiRouter.post("/api/customer/cart/items", expressRoute(customer__cart__items.POST));
// C-15 장바구니 수량 변경
apiRouter.patch("/api/customer/cart/items/:cartItemId", expressRoute(customer__cart__items__cartItemId.PATCH));
// C-16 장바구니 항목 삭제
apiRouter.delete("/api/customer/cart/items/:cartItemId", expressRoute(customer__cart__items__cartItemId.DELETE));
// C-20 고객 주문 내역 목록
apiRouter.get("/api/customer/orders", expressRoute(customer__orders.GET));
// C-19 주문 생성·가상 결제
apiRouter.post("/api/customer/orders", expressRoute(customer__orders.POST));
// C-18 주문서 미리보기 (선택)
apiRouter.post("/api/customer/orders/preview", expressRoute(customer__orders__preview.POST));
// C-21 고객 주문 상세·상태 조회
apiRouter.get("/api/customer/orders/:orderId", expressRoute(customer__orders__orderId.GET));
// C-22 고객 주문 취소
apiRouter.post("/api/customer/orders/:orderId/cancel", expressRoute(customer__orders__orderId__cancel.POST));
// C-24 리뷰 작성
apiRouter.post("/api/customer/orders/:orderId/review", expressRoute(customer__orders__orderId__review.POST));
// C-06 포인트 잔액·내역 조회
apiRouter.get("/api/customer/points", expressRoute(customer__points.GET));
// C-07 포인트 충전(가상 결제)
apiRouter.post("/api/customer/points/charges", expressRoute(customer__points__charges.POST));
// C-23 내 리뷰 목록 (선택)
apiRouter.get("/api/customer/reviews", expressRoute(customer__reviews.GET));
// C-25 리뷰 수정
apiRouter.patch("/api/customer/reviews/:reviewId", expressRoute(customer__reviews__reviewId.PATCH));
// C-26 리뷰 삭제
apiRouter.delete("/api/customer/reviews/:reviewId", expressRoute(customer__reviews__reviewId.DELETE));
// C-08 가게 목록·검색
apiRouter.get("/api/customer/stores", expressRoute(customer__stores.GET));
// C-09 고객 가게 상세 조회
apiRouter.get("/api/customer/stores/:storeId", expressRoute(customer__stores__storeId.GET));
// C-10 가게 메뉴 목록
apiRouter.get("/api/customer/stores/:storeId/menus", expressRoute(customer__stores__storeId__menus.GET));
// C-11 메뉴 상세·옵션 조회
apiRouter.get("/api/customer/stores/:storeId/menus/:menuId", expressRoute(customer__stores__storeId__menus__menuId.GET));
// C-12 가게 공개 리뷰 목록
apiRouter.get("/api/customer/stores/:storeId/reviews", expressRoute(customer__stores__storeId__reviews.GET));
// A-04 내 가게 목록
apiRouter.get("/api/owner/stores", expressRoute(owner__stores.GET));
// A-05 가게 추가 등록
apiRouter.post("/api/owner/stores", expressRoute(owner__stores.POST));
// S-01 가게 정보 조회
apiRouter.get("/api/owner/stores/:storeId", expressRoute(owner__stores__storeId.GET));
// S-02 운영 정보 수정
apiRouter.patch("/api/owner/stores/:storeId", expressRoute(owner__stores__storeId.PATCH));
// A-05 가게 재신청
apiRouter.put("/api/owner/stores/:storeId/application", expressRoute(owner__stores__storeId__application.PUT));
// S-04 영업시간 저장
apiRouter.put("/api/owner/stores/:storeId/hours", expressRoute(owner__stores__storeId__hours.PUT));
// M-14 메뉴 분류 목록
apiRouter.get("/api/owner/stores/:storeId/menu-categories", expressRoute(owner__stores__storeId__menu_categories.GET));
// M-15 메뉴 분류 등록
apiRouter.post("/api/owner/stores/:storeId/menu-categories", expressRoute(owner__stores__storeId__menu_categories.POST));
// M-16 메뉴 분류 수정
apiRouter.patch("/api/owner/stores/:storeId/menu-categories/:categoryId", expressRoute(owner__stores__storeId__menu_categories__categoryId.PATCH));
// M-17 메뉴 분류 삭제
apiRouter.delete("/api/owner/stores/:storeId/menu-categories/:categoryId", expressRoute(owner__stores__storeId__menu_categories__categoryId.DELETE));
// M-01 메뉴 목록
apiRouter.get("/api/owner/stores/:storeId/menus", expressRoute(owner__stores__storeId__menus.GET));
// M-03 메뉴 등록
apiRouter.post("/api/owner/stores/:storeId/menus", expressRoute(owner__stores__storeId__menus.POST));
// M-13 메뉴 순서·분류 일괄 변경
apiRouter.patch("/api/owner/stores/:storeId/menus/order", expressRoute(owner__stores__storeId__menus__order.PATCH));
// M-02 메뉴 상세 (옵션 포함)
apiRouter.get("/api/owner/stores/:storeId/menus/:menuId", expressRoute(owner__stores__storeId__menus__menuId.GET));
// M-04 메뉴 수정
apiRouter.patch("/api/owner/stores/:storeId/menus/:menuId", expressRoute(owner__stores__storeId__menus__menuId.PATCH));
// M-05 메뉴 삭제
apiRouter.delete("/api/owner/stores/:storeId/menus/:menuId", expressRoute(owner__stores__storeId__menus__menuId.DELETE));
// M-07 옵션 그룹 등록
apiRouter.post("/api/owner/stores/:storeId/menus/:menuId/option-groups", expressRoute(owner__stores__storeId__menus__menuId__option_groups.POST));
// M-06 판매 상태 변경
apiRouter.patch("/api/owner/stores/:storeId/menus/:menuId/sale-status", expressRoute(owner__stores__storeId__menus__menuId__sale_status.PATCH));
// S-03 영업 상태 변경
apiRouter.patch("/api/owner/stores/:storeId/oper-status", expressRoute(owner__stores__storeId__oper_status.PATCH));
// M-08 옵션 그룹 수정
apiRouter.patch("/api/owner/stores/:storeId/option-groups/:groupId", expressRoute(owner__stores__storeId__option_groups__groupId.PATCH));
// M-09 옵션 그룹 삭제
apiRouter.delete("/api/owner/stores/:storeId/option-groups/:groupId", expressRoute(owner__stores__storeId__option_groups__groupId.DELETE));
// M-10 옵션 등록
apiRouter.post("/api/owner/stores/:storeId/option-groups/:groupId/options", expressRoute(owner__stores__storeId__option_groups__groupId__options.POST));
// M-11 옵션 수정
apiRouter.patch("/api/owner/stores/:storeId/options/:optionId", expressRoute(owner__stores__storeId__options__optionId.PATCH));
// M-12 옵션 삭제
apiRouter.delete("/api/owner/stores/:storeId/options/:optionId", expressRoute(owner__stores__storeId__options__optionId.DELETE));
// O-01 주문 목록
apiRouter.get("/api/owner/stores/:storeId/orders", expressRoute(owner__stores__storeId__orders.GET));
// O-02 주문 상세 (주문서)
apiRouter.get("/api/owner/stores/:storeId/orders/:orderId", expressRoute(owner__stores__storeId__orders__orderId.GET));
// O-03 주문 접수
apiRouter.post("/api/owner/stores/:storeId/orders/:orderId/accept", expressRoute(owner__stores__storeId__orders__orderId__accept.POST));
// O-06 조리중 취소
apiRouter.post("/api/owner/stores/:storeId/orders/:orderId/cancel", expressRoute(owner__stores__storeId__orders__orderId__cancel.POST));
// O-05 조리 완료
apiRouter.post("/api/owner/stores/:storeId/orders/:orderId/cooked", expressRoute(owner__stores__storeId__orders__orderId__cooked.POST));
// O-04 주문 거절
apiRouter.post("/api/owner/stores/:storeId/orders/:orderId/reject", expressRoute(owner__stores__storeId__orders__orderId__reject.POST));
// R-06 내 신고 목록
apiRouter.get("/api/owner/stores/:storeId/reports", expressRoute(owner__stores__storeId__reports.GET));
// R-01 리뷰 목록
apiRouter.get("/api/owner/stores/:storeId/reviews", expressRoute(owner__stores__storeId__reviews.GET));
// R-02 답글 등록
apiRouter.post("/api/owner/stores/:storeId/reviews/:reviewId/reply", expressRoute(owner__stores__storeId__reviews__reviewId__reply.POST));
// R-03 답글 수정
apiRouter.patch("/api/owner/stores/:storeId/reviews/:reviewId/reply", expressRoute(owner__stores__storeId__reviews__reviewId__reply.PATCH));
// R-04 답글 삭제
apiRouter.delete("/api/owner/stores/:storeId/reviews/:reviewId/reply", expressRoute(owner__stores__storeId__reviews__reviewId__reply.DELETE));
// R-05 리뷰 신고
apiRouter.post("/api/owner/stores/:storeId/reviews/:reviewId/report", expressRoute(owner__stores__storeId__reviews__reviewId__report.POST));
// T-01 기간별 매출
apiRouter.get("/api/owner/stores/:storeId/sales", expressRoute(owner__stores__storeId__sales.GET));
// T-02 메뉴별 매출
apiRouter.get("/api/owner/stores/:storeId/sales/menus", expressRoute(owner__stores__storeId__sales__menus.GET));
// D-06 현재 배달
apiRouter.get("/api/rider/deliveries/current", expressRoute(rider__deliveries__current.GET));
// D-09 배달 내역
apiRouter.get("/api/rider/deliveries/history", expressRoute(rider__deliveries__history.GET));
// D-05 배차 수락
apiRouter.post("/api/rider/deliveries/:deliveryId/accept", expressRoute(rider__deliveries__deliveryId__accept.POST));
// D-08 배달 완료
apiRouter.post("/api/rider/deliveries/:deliveryId/complete", expressRoute(rider__deliveries__deliveryId__complete.POST));
// D-07 픽업 완료
apiRouter.post("/api/rider/deliveries/:deliveryId/pickup", expressRoute(rider__deliveries__deliveryId__pickup.POST));
// D-04 배차 대기 목록
apiRouter.get("/api/rider/dispatch-requests", expressRoute(rider__dispatch_requests.GET));
// D-02 내 라이더 정보
apiRouter.get("/api/rider/me", expressRoute(rider__me.GET));
// D-03 활동 정보 수정
apiRouter.patch("/api/rider/me", expressRoute(rider__me.PATCH));
