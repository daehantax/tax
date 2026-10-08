// 쉼표 표시 함수
function formatNumber(input) {
    // Remove commas and non-numeric characters
    var numericValue = input.value.replace(/,/g, '').replace(/\D/g, '');
    // Format with commas and update the input value
    input.value = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}



//간단한 양도세 계산기 (양도세 단순 페이지용)
// 장기보유특별공제는 일반(표1) 기준, 1세대1주택 비과세·중과·단기세율은 반영하지 않음
function calculateTaxes() {
    var num = function (id) {
        return parseFloat(document.getElementById(id).value.replace(/,/g, '')) || 0;
    };
    var transferPrice = num('transferPrice');
    var acquisitionPrice = num('acquisitionPrice');
    var holdingPeriod = parseFloat(document.getElementById('holdingPeriod').value) || 0;

    var capitalGain = Math.max(0, transferPrice - acquisitionPrice);
    var longTermDeduction = Math.floor(calculateLongTermDeduction(capitalGain, holdingPeriod));
    var taxableIncome = capitalGain - longTermDeduction;
    var taxBase = Math.max(0, taxableIncome - 2500000);          // 기본공제 250만원
    var transferTax = Math.floor(calculateTransferTax(taxBase));  // 원 미만 절사
    var localIncomeTax = Math.floor(transferTax * 0.1);
    var totalTax = transferTax + localIncomeTax;

    document.getElementById('transferValue').innerText = transferPrice.toLocaleString();
    document.getElementById('acquisitionValue').innerText = acquisitionPrice.toLocaleString();
    document.getElementById('capitalGain').innerText = capitalGain.toLocaleString();
    document.getElementById('longTermDeduction').innerText = longTermDeduction.toLocaleString();
    document.getElementById('taxableIncome').innerText = taxableIncome.toLocaleString();
    document.getElementById('taxBase').innerText = taxBase.toLocaleString();
    var rateCell = document.getElementById('transferRate');
    if (rateCell) rateCell.innerText = taxBase > 0 ? transferRateText(taxBase) : '-';
    document.getElementById('transferTax').innerText = transferTax.toLocaleString();
    document.getElementById('localIncomeTax').innerText = localIncomeTax.toLocaleString();
    document.getElementById('totalTax').innerText = totalTax.toLocaleString();
}

//장기보유특별공제 표1: 3년 6% ~ 15년 30% (만 년수 기준)
function calculateLongTermDeduction(capitalGain, holdingPeriod) {
    var years = Math.floor(holdingPeriod);
    if (years < 3) return 0;
    return capitalGain * Math.min(0.3, 0.02 * years);
}

// 과세표준 구간의 세율 표시용
function transferRateText(taxBase) {
    var limits = [14000000, 50000000, 88000000, 150000000, 300000000, 500000000, 1000000000];
    var rates = [6, 15, 24, 35, 38, 40, 42, 45];
    for (var i = 0; i < limits.length; i++) {
        if (taxBase <= limits[i]) return rates[i] + '%';
    }
    return '45%';
}

// 양도세율표
function calculateTransferTax(taxBase) {
if (taxBase <= 14000000) {
    return taxBase * 0.06; // 6%
} else if (taxBase <= 50000000) {
    return taxBase * 0.15 - 1260000; // 15%, 1260000원 공제
} else if (taxBase <= 88000000) {
    return taxBase * 0.24 - 5760000; // 24%, 5760000원 공제
} else if (taxBase <= 150000000) {
    return taxBase * 0.35 - 15440000; // 35%, 15440000원 공제
} else if (taxBase <= 300000000) {
    return taxBase * 0.38 - 19940000; // 38%, 19940000원 공제
} else if (taxBase <= 500000000) {
    return taxBase * 0.40 - 25940000; // 40%, 25940000원 공제
} else if (taxBase <= 1000000000) {
    return taxBase * 0.42 - 35940000; // 42%, 35940000원 공제
} else {
    return taxBase * 0.45 - 65940000; // 45%, 65940000원 공제
}
}

//상속세 계산기 (단순한 상속세 계산기 페이지용)
function calculateInheritanceTax() {
    var num = function (id) {
        return parseFloat(document.getElementById(id).value.replace(/,/g, '')) || 0;
    };
    var houseValue = num('houseValue');
    var buildingValue = num('buildingValue');
    var agriculturalLandValue = num('agriculturalLandValue');
    var forestLandValue = num('forestLandValue');
    var otherProperty = num('otherProperty');
    var debts = num('debts');
    var giftFromMother = num('giftFromMother');
    var giftToChildren = num('giftToChildren');
    var giftToOthers = num('giftToOthers');

    // 배우자 유무에 따른 상속공제 (일괄공제 5억 + 배우자공제 최소 5억)
    var hasSpouse = document.getElementById('hasSpouse').checked;
    var baseDeduction = hasSpouse ? 1000000000 : 500000000;
    document.getElementById('inheritanceDeduction').value = baseDeduction.toLocaleString();

    // 감정평가수수료는 최대 5,000,000원까지만 인정 (상증령 20조의3)
    var appraisalFee = Math.min(num('appraisalFee'), 5000000);
    document.getElementById('appraisalFee').value = appraisalFee.toLocaleString();

    var giftTaxDeduction = num('giftTaxDeduction');

    var totalProperty = houseValue + buildingValue + agriculturalLandValue + forestLandValue + otherProperty;
    var priorGifts = giftFromMother + giftToChildren + giftToOthers;
    var taxableAmount = Math.max(0, totalProperty - debts + priorGifts);

    // 상속공제 종합한도 (상증법 24조) = 과세가액 - 사전증여재산
    // 원래는 사전증여재산의 '증여세 과세표준'을 빼지만, 여기서는 증여가액 전액을 빼서 보수적으로 계산
    var deductionLimit = Math.max(0, taxableAmount - priorGifts);
    var inheritanceDeduction = Math.min(baseDeduction, deductionLimit);

    var taxBase = Math.max(0, taxableAmount - inheritanceDeduction - appraisalFee);
    if (taxBase < 500000) taxBase = 0; // 과세최저한: 과세표준 50만원 미만은 과세하지 않음 (상증법 25조②)

    var calculatedTax = Math.floor(calculateInheritTariff(taxBase));
    // 증여세액공제는 산출세액을 넘을 수 없음
    var giftCredit = Math.min(giftTaxDeduction, calculatedTax);
    // 신고세액공제 3% = (산출세액 - 증여세액공제) × 3% (상증법 69조)
    var reportCredit = Math.floor((calculatedTax - giftCredit) * 0.03);
    var taxDeduction = giftCredit + reportCredit;
    var payableTax = Math.max(0, calculatedTax - taxDeduction);

    document.getElementById('totalPropertyValueCell').innerText = totalProperty.toLocaleString();
    document.getElementById('debtsValueCell').innerText = debts.toLocaleString();
    document.getElementById('priorGiftsValueCell').innerText = priorGifts.toLocaleString();
    document.getElementById('taxableAmountValueCell').innerText = taxableAmount.toLocaleString();
    document.getElementById('inheritanceDeductionValueCell').innerText = inheritanceDeduction.toLocaleString();
    document.getElementById('appraisalFeeValueCell').innerText = appraisalFee.toLocaleString();
    document.getElementById('taxBaseValueCell').innerText = taxBase.toLocaleString();
    document.getElementById('calculatedTaxValueCell').innerText = calculatedTax.toLocaleString();
    document.getElementById('taxDeductionValueCell').innerText = taxDeduction.toLocaleString();
    document.getElementById('payableTaxValueCell').innerText = payableTax.toLocaleString();
}


function updateInheritanceDeduction() {
    var hasSpouse = document.getElementById('hasSpouse').checked;
    var inheritanceDeduction = hasSpouse ? 1000000000 : 500000000;
    document.getElementById('inheritanceDeduction').value = inheritanceDeduction.toLocaleString();
}

// 상속세율표

function calculateInheritTariff(taxBase) {
    if (taxBase <= 100000000) {
        return taxBase * 0.1; // 10%
    } else if (taxBase <= 500000000) {
        return taxBase * 0.2 - 10000000; // 20%, 10,000,000원 공제
    } else if (taxBase <= 1000000000) {
        return taxBase * 0.3 - 60000000; // 30%, 60,000,000원 공제
    } else if (taxBase <= 3000000000) {
        return taxBase * 0.4 - 160000000; // 40%, 160,000,000원 공제
    } else {
        return taxBase * 0.5 - 460000000; // 50%, 460,000,000원 공제
    }
}

//---------------------------------------------
    //
    //   재산세 계산함수
    //
    //  입력: one_o_one "1세대1주택" "다주택" 
    //        official_price 공시지가
    //
    //
    //----------------------------------------------
    function calc_property_tax(one_o_one, gongsi){
    
        var tax_base = 0, dosi_tax, p_edu_tax, property_tax;
    
        // 과세표준 = 공시지가*60%. 2022.6.16 1세대1주택자 하향조정
        // if(one_o_one == "1세대1주택") {tax_base = gongsi*0.45;}
        // 2023.6.1 이후 적용
        
        if(one_o_one == "1세대1주택") {
            if(gongsi <= 300000000) {tax_base = gongsi*0.43;}
            else if(gongsi <= 600000000){tax_base = gongsi*0.44;}
            else {tax_base = gongsi*0.45;}
        }
        else {tax_base = gongsi*0.6;}; 
        
        if (gongsi <= 900000000) { //시가표준액9억이하인 경우 과표6억이하특례 2021-2023한시적운영
            switch (true){
            case tax_base <= 60000000:
                property_tax = tax_base*0.0005;
                    break;
            case tax_base <= 150000000:
                property_tax = 30000 + (tax_base-60000000)*0.001;
                break;
            case tax_base <= 300000000:
                property_tax = 120000 + (tax_base-150000000)*0.002;
                break;
            default: //3억초과
                property_tax = 420000 + (tax_base-300000000)*0.0035;
            }
        }
        else //9억초과세율 
        {
            switch (true){
            case tax_base <= 60000000:
                property_tax = tax_base*0.001;
                break;
            case tax_base <= 150000000:
                property_tax = 60000 + (tax_base-60000000)*0.0015;
                break;
            case tax_base <= 300000000:
                property_tax = 195000 + (tax_base-150000000)*0.0025;
                break;
            default: //3억초과
                property_tax = 570000 + (tax_base-300000000)*0.004;
            }
        }    
    
        dosi_tax = tax_base*14/10000;
        p_edu_tax = property_tax*2/10;
    
        return [property_tax, dosi_tax, p_edu_tax];
    
        };

        // 모든 연결은 상속세 절세보고서 프리미엄으로 이동
        function goToPremiumPage() {
            window.location.href = 'inheritPremium.html';
        }

