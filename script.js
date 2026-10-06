/**
 * =================================================================
 * 바이브 카페 주문서 및 주문 내역 자바스크립트 (script.js)
 * =================================================================
 */

// -------------------------------------------------------------
// 0. Supabase 접속 설정 (URL과 KEY는 본인의 값으로 직접 입력해주세요)
// -------------------------------------------------------------
const SUPABASE_URL = 'https://doixybundkkmtndtubtc.supabase.co'; // 본인의 Supabase Project URL 입력
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaXh5YnVuZGtrbXRuZHR1YnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2Mjk5MTcsImV4cCI6MjEwNjIwNTkxN30.NIkxFjnbvyGTZjSgWCQPgUFuzced_k64Hmm9lJ05VPs'; // 본인의 Supabase anon public API Key 입력

// Supabase 클라이언트 생성 (요청하신 변수명: supabaseClient)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// -------------------------------------------------------------
// 1. 주문 데이터 관리 (로컬 배열 및 주문 번호 카운터)
// -------------------------------------------------------------
let orders = []; // 접수된 주문 목록을 저장할 배열
let orderSequence = 1; // 주문 번호 발급용 (#1, #2, ...)

// -------------------------------------------------------------
// 2. HTML 요소(DOM) 참조
// -------------------------------------------------------------
// 탭 관련 요소
const tabOrderBtn = document.getElementById('tabOrderBtn'); // '☕ 주문하기' 탭 버튼
const tabHistoryBtn = document.getElementById('tabHistoryBtn'); // '📋 주문 내역' 탭 버튼
const orderSection = document.getElementById('orderSection'); // 주문서 섹션
const historySection = document.getElementById('historySection'); // 주문 내역 섹션
const orderCountBadge = document.getElementById('orderCountBadge'); // 주문 건수 배지

// 주문서 입력 폼 관련 요소
const orderForm = document.getElementById('orderForm'); // 폼 전체
const userNameInput = document.getElementById('userName'); // 이름 입력창
const userPhoneInput = document.getElementById('userPhone'); // 전화번호 입력창
const drinkSelect = document.getElementById('drinkSelect'); // 음료 선택 드롭다운
const quantityInput = document.getElementById('quantity'); // 수량 입력창
const requestsInput = document.getElementById('requests'); // 요청사항 텍스트 영역
const totalPriceEl = document.getElementById('totalPrice'); // 예상 금액 표시 span
const submitBtn = document.getElementById('submitBtn'); // 주문하기 버튼
const orderConfirmationEl = document.getElementById('orderConfirmation'); // 주문 완료 메시지 div

// 주문 내역 탭 관련 요소
const emptyNotice = document.getElementById('emptyNotice'); // 주문 없을 때 안내 문구
const ordersList = document.getElementById('ordersList'); // 주문 카드들이 들어갈 컨테이너
const historySummary = document.getElementById('historySummary'); // 주문 내역 하단 요약 영역
const totalSummaryText = document.getElementById('totalSummaryText'); // 총 금액/건수 텍스트
const clearAllBtn = document.getElementById('clearAllBtn'); // 내역 모두 지우기 버튼

// -------------------------------------------------------------
// 3. 탭 전환 기능
// -------------------------------------------------------------
/**
 * 탭을 전환하는 함수
 * @param {string} targetTab - 'order' 또는 'history'
 */
function switchTab(targetTab) {
  if (targetTab === 'order') {
    // '주문하기' 탭 활성화
    tabOrderBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');

    // 주문서 표시, 주문 내역 숨김
    orderSection.classList.remove('hidden');
    orderSection.removeAttribute('hidden');
    historySection.classList.add('hidden');
    historySection.setAttribute('hidden', '');
  } else if (targetTab === 'history') {
    // '주문 내역' 탭 활성화
    tabHistoryBtn.classList.add('active');
    tabOrderBtn.classList.remove('active');

    // 주문 내역 표시, 주문서 숨김
    historySection.classList.remove('hidden');
    historySection.removeAttribute('hidden');
    orderSection.classList.add('hidden');
    orderSection.setAttribute('hidden', '');

    // 최신 주문 내역 화면 다시 그리기
    renderOrders();
  }
}

// 탭 버튼 클릭 이벤트 등록
tabOrderBtn.addEventListener('click', () => switchTab('order'));
tabHistoryBtn.addEventListener('click', () => switchTab('history'));

// -------------------------------------------------------------
// 4. 예상 금액 실시간 계산 함수 (calculateTotal)
// -------------------------------------------------------------
/**
 * 음료, 사이즈, 옵션, 수량을 바탕으로 총 금액을 계산하여 화면에 표시하는 함수
 * @returns {number} 계산된 총 금액 (원)
 */
function calculateTotal() {
  // (1) 음료 기본 가격 가져오기 (data-price 속성)
  const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkPrice = selectedOption ? parseInt(selectedOption.dataset.price || '0', 10) : 0;

  // 음료를 선택하지 않았으면 0원 표시 후 종료
  if (drinkPrice === 0) {
    totalPriceEl.textContent = '0';
    return 0;
  }

  // (2) 선택된 사이즈 추가 금액
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');
  const sizePrice = selectedSize ? parseInt(selectedSize.dataset.price || '0', 10) : 0;

  // (3) 선택된 추가 옵션들의 추가 금액 합산
  const checkedOptions = orderForm.querySelectorAll('input[name="extraOption"]:checked');
  let optionsPrice = 0;
  checkedOptions.forEach((option) => {
    optionsPrice += parseInt(option.dataset.price || '0', 10);
  });

  // (4) 수량 확인 (기본값 1)
  let quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }

  // (5) 한 잔당 금액 = 음료 가격 + 사이즈 추가금 + 옵션 합계
  const unitPrice = drinkPrice + sizePrice + optionsPrice;

  // (6) 총 금액 = 한 잔당 금액 * 수량
  const total = unitPrice * quantity;

  // (7) 천 단위 콤마(toLocaleString)를 붙여 화면에 출력
  totalPriceEl.textContent = total.toLocaleString();

  return total;
}

// 폼 입력값이 바뀔 때마다 실시간으로 금액 재계산
orderForm.addEventListener('input', calculateTotal);
orderForm.addEventListener('change', calculateTotal);

// -------------------------------------------------------------
// 5. 주문 내역 화면 그리기 함수 (renderOrders)
// -------------------------------------------------------------
/**
 * orders 배열의 주문들을 베이지 카드로 화면에 출력하는 함수
 * 보안을 위해 사용자가 입력한 모든 값은 textContent로 안전하게 삽입합니다.
 */
function renderOrders() {
  // 주문 건수 배지 업데이트
  orderCountBadge.textContent = orders.length;

  // 기존 목록 비우기
  ordersList.textContent = '';

  // 주문 내역이 하나도 없을 때
  if (orders.length === 0) {
    emptyNotice.classList.remove('hidden');
    emptyNotice.removeAttribute('hidden');
    historySummary.classList.add('hidden');
    historySummary.setAttribute('hidden', '');
    return;
  }

  // 주문 내역이 있을 때
  emptyNotice.classList.add('hidden');
  emptyNotice.setAttribute('hidden', '');
  historySummary.classList.remove('hidden');
  historySummary.removeAttribute('hidden');

  // 총 누적 주문 금액 합산
  const totalAmountSum = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  totalSummaryText.textContent = `총 주문 금액: ${totalAmountSum.toLocaleString()}원 (${orders.length}건)`;

  // 각 주문을 순회하며 카드 DOM 생성
  orders.forEach((order) => {
    // 카드 컨테이너 (베이지 카드 + 왼쪽 갈색 세로줄)
    const card = document.createElement('div');
    card.className = 'order-card';

    // 1줄: 상단 영역 (제목 및 취소 버튼)
    const topRow = document.createElement('div');
    topRow.className = 'order-card-top';

    const titleEl = document.createElement('span');
    titleEl.className = 'order-card-title';
    titleEl.textContent = `#${order.orderId} ${order.name}님 · ${order.totalPrice.toLocaleString()}원`;

    // 취소 버튼
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = '취소';

    cancelBtn.addEventListener('click', () => {
      if (confirm(`#${order.orderId}번 주문(${order.name}님)을 취소하시겠습니까?`)) {
        orders = orders.filter((item) => item.orderId !== order.orderId);
        renderOrders();
      }
    });

    topRow.appendChild(titleEl);
    topRow.appendChild(cancelBtn);

    // 2줄: 음료, 사이즈, 옵션, 수량 (예: "카페라떼 M사이즈 (샷 추가) 1잔")
    const descEl = document.createElement('div');
    descEl.className = 'order-card-desc';
    descEl.textContent = `${order.drink} ${order.size}사이즈${order.optionText} ${order.quantity}잔`;

    // 3줄: 요청사항(있을 때만) · 주문 시간
    const metaEl = document.createElement('div');
    metaEl.className = 'order-card-meta';
    if (order.requests) {
      metaEl.textContent = `${order.requests} · ${order.orderTime}`;
    } else {
      metaEl.textContent = order.orderTime;
    }

    card.appendChild(topRow);
    card.appendChild(descEl);
    card.appendChild(metaEl);

    ordersList.appendChild(card);
  });
}

// -------------------------------------------------------------
// 6. 내역 모두 지우기 버튼 처리
// -------------------------------------------------------------
clearAllBtn.addEventListener('click', () => {
  if (orders.length === 0) return;

  if (confirm('모든 주문 내역을 삭제하시겠습니까?')) {
    orders = [];
    renderOrders();
  }
});

// -------------------------------------------------------------
// 7. 주문하기 버튼 처리 (Supabase orders 테이블 저장 연동)
// -------------------------------------------------------------
orderForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // 페이지 새로고침 방지

  // (1) 이름 유효성 검사
  const customerName = userNameInput.value.trim();
  if (!customerName) {
    alert('이름을 입력해주세요');
    userNameInput.focus();
    return;
  }

  // (2) 음료 선택 유효성 검사
  if (!drinkSelect.value) {
    alert('음료를 선택해주세요');
    drinkSelect.focus();
    return;
  }

  // (3) 주문 데이터 추출 및 정리
  const phone = userPhoneInput.value.trim(); // 전화번호
  const selectedDrinkOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkName = selectedDrinkOption.text.replace(/\s*[0-9,]+원$/, '').trim(); // 음료 이름
  const drinkPrice = parseInt(selectedDrinkOption.dataset.price || '0', 10); // 음료 기본 가격 (숫자)

  // 사이즈 (S, M, L)
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');
  const sizeName = selectedSize ? selectedSize.value : 'M';

  // 추가 옵션 목록을 배열(Array) 형태로 추출
  const checkedOptions = orderForm.querySelectorAll('input[name="extraOption"]:checked');
  const optionNames = [];
  checkedOptions.forEach((option) => {
    const label = orderForm.querySelector(`label[for="${option.id}"]`);
    if (label) {
      const cleanOptionName = label.textContent.replace(/\s*\+[0-9,]+원$/, '').trim();
      optionNames.push(cleanOptionName);
    }
  });

  // 주문 확인 메시지용 옵션 텍스트 (옵션이 있으면 괄호 표기)
  const optionText = optionNames.length > 0 ? ` (${optionNames.join(', ')})` : '';

  // 수량
  let quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }

  // 요청사항
  const userRequest = requestsInput.value.trim();

  // 총 결제 금액 (calculateTotal 재사용)
  const totalAmount = calculateTotal();

  // (4) 중복 클릭 방지: 주문하기 버튼 비활성화
  submitBtn.disabled = true;
  submitBtn.textContent = '주문 저장 중...';

  try {
    // (5) Supabase orders 테이블에 주문 데이터 INSERT
    const { data, error } = await supabaseClient
      .from('orders')
      .insert([
        {
          customer_name: customerName,
          phone: phone,
          drink: drinkName,
          drink_price: drinkPrice,
          size: sizeName,
          options: optionNames, // 배열(text[]) 형태로 전송
          quantity: quantity,
          request: userRequest,
          total_price: totalAmount,
        },
      ])
      .select();

    // 에러 발생 시 처리
    if (error) {
      throw error;
    }

    // (6) 저장 성공 처리
    // 현재 시간 포맷팅
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Supabase에서 발급된 고유 id가 있으면 사용, 없으면 시퀀스 사용
    const savedOrderId = data && data[0] && data[0].id ? data[0].id : orderSequence++;

    // 로컬 orders 배열에 추가하여 주문 내역 탭에도 반영
    const newOrder = {
      orderId: savedOrderId,
      name: customerName,
      drink: drinkName,
      size: sizeName,
      optionText: optionText,
      quantity: quantity,
      requests: userRequest,
      totalPrice: totalAmount,
      orderTime: timeString,
    };
    orders.unshift(newOrder);
    renderOrders(); // 주문 내역 탭 갱신

    // 주문 확인 메시지 출력
    const confirmationMessage = `${customerName}님, ${drinkName} ${sizeName}사이즈${optionText} ${quantity}잔, 총 ${totalAmount.toLocaleString()}원 주문이 접수되었습니다!`;
    orderConfirmationEl.textContent = confirmationMessage;
    orderConfirmationEl.removeAttribute('hidden');
    orderConfirmationEl.classList.remove('hidden');

    // 주문 확인 메시지로 스크롤 이동
    orderConfirmationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    // 저장 실패 처리
    console.error('주문 저장 실패 에러 상세:', err);
    alert('주문 저장에 실패했어요');
  } finally {
    // (7) 작업 완료 후 주문하기 버튼 다시 활성화
    submitBtn.disabled = false;
    submitBtn.textContent = '주문하기';
  }
});

// -------------------------------------------------------------
// 8. 다시 작성 버튼 처리 (form reset)
// -------------------------------------------------------------
orderForm.addEventListener('reset', () => {
  // 주문 확인 메시지 숨김
  orderConfirmationEl.textContent = '';
  orderConfirmationEl.setAttribute('hidden', '');
  orderConfirmationEl.classList.add('hidden');

  // 기본값으로 복원된 후 금액을 0원으로 갱신
  setTimeout(() => {
    calculateTotal();
  }, 0);
});

// -------------------------------------------------------------
// 9. 페이지 로드 시 초기 실행
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  calculateTotal();
  renderOrders();
});
