




//------------------------------------------------------------------
//
//   증여세 계산함수
//
//  입력:  give_rel 증여자관계, is_skip 새대할증여부 SKIP_T/SKIP_F로 입력
//         sail_price 시가, t_age 자녀연령(만나이)
//
//  * 해외거주자, 부담부증여, 10년이내증여 고려되지 않음
//
//-----------------------------------------------------------------

//상수정의
const CHILD = 1, SPOUSE = 2, PARENTS = 3, EXT_REL = 4, ETC = 5; 
const SKIP_T = 1, SKIP_F = 2;

function calc_give_tax(give_rel, is_skip, sail_price, t_age){
// 증여세 과세가액 = 증여재산가액 - 비과세등불산입액 - 채무액 + 10년이내증여재산가산
    var tax_price = sail_price;

    //공제액
    var deduct = 0; 
    if(give_rel == CHILD) {
        if(t_age <= 19){ deduct = 20000000;}
        else { deduct = 50000000;}
    }
    else if(give_rel == SPOUSE){ deduct = 600000000;}
    else if(give_rel == PARENTS){ deduct = 50000000;}
    else if(give_rel == EXT_REL){ deduct = 10000000;}

    
    //과세표준 = 과세가액 - 증여공제
    var tax_std = Math.max(tax_price - deduct,0);
//alert(tax_std);
    //세율 및 누진공제
    var tax_rate = 0, acc_deduct = 0;
    if(tax_std <= 0){ tax_dtd = 0;}
	if(tax_std <= 100000000){ tax_rate = 0.1;  acc_deduct = 0 } else  
	if(tax_std <= 500000000){ tax_rate = 0.2;  acc_deduct = 10000000 } else 
	if(tax_std <= 1000000000){ tax_rate = 0.3; acc_deduct = 60000000 } else 
	if(tax_std <= 3000000000){ tax_rate = 0.4; acc_deduct = 160000000 } else 
	{ tax_rate = 0.5; acc_deduct = 460000000 }
//alert(tax_rate+" "+acc_deduct);
    //새대생략할증 없으면 0%. 30%, 20억초과시 40%
    var skip_charge = 0;
    if(is_skip == SKIP_T){ 
        skip_charge = 0.3; 
        if(tax_price>2000000000) skip_charge = 0.4;} 
    else { skip_charge = 0}
//alert(tax_std+" "+is_skip+" "+skip_charge+" "+acc_deduct);
    //증여세 산출세액 = 과세표준*세율 - 누진공제액
    var give_tax = tax_std*tax_rate - acc_deduct;

    //납부세액: 생략할증,성실신고 반영, 세액공제미반영
    var f_give_tax = give_tax*(1+skip_charge)*(1-0.03); 
//alert(give_tax+" "+f_give_tax);  

return f_give_tax;

}

   
   //------------------------------------------------------
   //
   //   취득세 계산함수
   //
   //   입력: type 취득유형() 유상취득"normal" 상속"inherit" 증여"give" 원시취득"pre" 1세대1주택자의 증여 "give1s1h"
   //         price 취득당시가액
   //         new_house 1주택(0), 비조정2번째취득(1), 조정&2번째(8), 비조정&3번째(8), 조정&3주택(12),4주택이상(12), 법인(12)
   //         inherit_house 상속자의 주택유(1),무(0)
   //         space 85이하(85), 85초과(86)
   //         heavy 증여시 적용 - 조정지역(1),비조정지역(0)
   //    기타: 1. 증여취득시 직계존비속이 아닌경우 본 함수 사용하지 말것
   //          2. calc_give_taking_etc_tax() : 임시로 증여,비가족 취득세일경우 사용
   //          3. 2023.10.24 type에 증여자 "1세대1주택자의 증여" 포함
   //         2022.12.21>> new_house 1주택(0), 비조정2번째취득(0), 조정&2번째(0), 비조정&3번째(4), 조정&3주택(6),4주택이상(6), 법인(6) - 해당내용취소 작업일 2023.10.12
   //--------------------------------------------------------
   function calc_taking_tax(type, price, new_house, inherit_house, space, heavy){
       
    var t,take_tax,l,v,t2,t3,i,ag_tax,r,edu_tax,i2,i3;
    var take_rate, edu_rate; // 취득세율,지방교육세율
	var ag_rate = 0.002; // 농특세율 초기화.중과세에만 재적용

	//2020.8.12일 이후 기준으로 변경 
	if( type == "normal"){ // 일반매매
		if(new_house == 0 ){
			if(price<=600000000){
				take_rate = 1/100;
			}
			else if(price>600000000 && price <=900000000){
				take_rate = Math.round((price*(2/300000000)-3)*10000)/10000/100;// 세율(%)을 소수점 다섯째자리에서 반올림해 넷째자리까지 (지방세법 11조①8호). 예) 7억 → 1.6667%
			}
			else if (price>900000000){
				take_rate = 0.03;
			}
			edu_rate = take_rate*0.1;
		}
		else{
			take_rate = new_house / 100;
			edu_rate = 0.004
   			//2023.12.21이후 중과완화 반영.농특세는 6%만 재조정- 2023.10.12 변경.완화 취소로.
               if(new_house == 8){ag_rate = 0.006;}
			else if(new_house == 12) {ag_rate = 0.01;}
		}
	} 
    else if ( type == "inherit"){ //상속

		if( inherit_house == 0){
			take_rate = 0.008;
			ag_rate = 0; //무주택자상속시 농어촌특별세면제
		} else {
			take_rate = 0.028;
		}
		edu_rate = 0.0016

	}
	else if ( type == "give"){ //증여

        if(heavy == 1 && price >= 300000000) { 
			take_rate = 0.12; 
			edu_rate = 0.004;
			ag_rate = 0.01;
		}
		else { 
			take_rate = 0.035;
			edu_rate = 0.003;
	    }
    }
    else if ( type == "give1s1h"){ //1세대1주택자가 배우자및직계비속에게 증여시 중과세제외
        take_rate = 0.035;
        edu_rate = 0.003;
    }
    else if ( type == "pre" ){ //원시취득

		take_rate = 0.028;
		edu_rate = 0.0016;
	}

	//새로 취득하는 주택을 포함한 세대 보유주택 수??
	//if(new_house == 1){take_rate = 0.04;take_tax = Math.floor(price*take_rate);}

	take_tax = price*take_rate;//취득세
	edu_tax = price*edu_rate; //지방교육세

	if(space == 86){
		ag_tax = Math.floor(price*ag_rate); //농어촌특별세
	} else {
		ag_rate = 0;
		ag_tax = 0 ;
	}


	/* 감면 - 임대사업자 관련사항인듯..추후 필요시 추가*/

    return [take_tax, ag_tax, edu_tax];
      
    }

    //임시- 증여,비가족 취득세 calc_give_taking_etc_tax()사용
    function calc_give_taking_etc_tax(price,space,heavy){
       
       var take_tax,ag_tax,edu_tax;
       var take_rate, edu_rate; // 취득세율,지방교육세율
       var ag_rate = 0.002; // 농특세율 초기화.중과세에만 재적용
   
       //2020.8.12일 이후 기준으로 변경 
  
           if(heavy == 1 && price >= 300000000) { 
               take_rate = 0.12; 
               edu_rate = 0.004;
               ag_rate = 0.01;
           }
           else { 
               take_rate = 0.035;
               edu_rate = 0.003;
           }
           
       take_tax = price*take_rate;//취득세
       edu_tax = price*edu_rate; //지방교육세
   
       if(space == 86){
           ag_tax = Math.floor(price*ag_rate); //농어촌특별세
       } else {
           ag_rate = 0;
           ag_tax = 0 ;
       }
   
        return [take_tax, ag_tax, edu_tax];
         
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
    //if(one_o_one == "1세대1주택") {tax_base = gongsi*0.45;}
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
    
    //------------------------------------------
    //
    // 종부세계산함수
    //
    // 입력: one_o_one "1세대1주택" "다주택" "공동명의1주택"
    //       heavy "조정지역" "비조정지역"
    //       gongsi 공시금액
    //       period 보유기간
    //       age 연령
    //       property_tax 재산세로부과된 세액
    //       
    // * 3주택이상 고려되지 않음
    //is_1s1h: 단독1세대1주택소유 0, 공동소유및다주택 1
    // 2023.1.12 2023.1.1이후적용개정안반영-기본공제금액6억->9억, 11억->12억, 세율조정
    // 2023년 세율적용: 조정지역관계없이 2주택이하/3주택이상으로 일반/중과적용(리포트는2주택이하만반영)
    //----------------------------------------
    function calc_aggr_tax(one_o_one, heavy, gongsi, period, age, property_tax){

    var aggr_tax_base, aggr_tax, aggr_tax_final;
    var deduct_amt, prd_dc, age_dc, rate_type, property_tax_dc, period_age_dc; 
    var p_real_rate; //재산세 공정가액비율.2022년 한시적으로 입력.추후 수정필요

    // 공제액 1주택일경우 2023년이후 12억(과거엔11억) 다주택/공동명의일경우 9억
    if(one_o_one == "1세대1주택") {deduct_amt = 1200000000; }
    else {deduct_amt = 900000000; }

    //과세표준 = (공시가격 - 공제금액) * 공정시장가액비율(2022년 60%)
    aggr_tax_base = Math.max((gongsi - deduct_amt),0) * 6/10; 
//alert("공시가"+gongsi+"공제액"+deduct_amt);
//alert("과세표준"+aggr_tax_base);
    //현재 리포트에서는 2주택까지만 가정. 고로 무조건 일반세율
  //  if(one_o_one == "1세대1주택" || one_o_one == "공동명의1주택" || heavy == "비조정지역"){ 
		switch (true){
			case aggr_tax_base <= 300000000:
				aggr_tax = aggr_tax_base*5/1000;
				break;
			case aggr_tax_base <= 600000000:
				aggr_tax = aggr_tax_base*7/1000 - 600000;
				break;
			case aggr_tax_base <= 1200000000:
				aggr_tax = aggr_tax_base*10/1000 - 2400000;
				break;
            case aggr_tax_base <= 2500000000:
				aggr_tax = aggr_tax_base*13/1000 - 6000000;
				break;
			case aggr_tax_base <= 5000000000:
				aggr_tax = aggr_tax_base*15/1000 - 11000000;
				break;
			case aggr_tax_base <= 9400000000:
				aggr_tax = aggr_tax_base*20/1000 - 36000000;
				break;
			default: //94억초과
            aggr_tax = aggr_tax_base*27/1000 - 101800000;
  		};
        //  alert("일반세율 산출세액"+aggr_tax);
    //}
    //else { //3주택이상 2023년
	//	switch (true){
	//		case aggr_tax_base <= 300000000:
	//			aggr_tax = aggr_tax_base*5/1000;
	//			break;
	//		case aggr_tax_base <= 600000000:
	//			aggr_tax = aggr_tax_base*7/1000 - 600000;
	//			break;
	//		case aggr_tax_base <= 1200000000:
	//			aggr_tax = aggr_tax_base*10/1000 - 2400000;
	//			break;
	//		case aggr_tax_base <= 2500000000:
	//			aggr_tax = aggr_tax_base*20/1000 - 14400000;
	//			break;
	//		case aggr_tax_base <= 5000000000:
	//			aggr_tax = aggr_tax_base*30/1000 - 39400000;
	//			break;
	//		case aggr_tax_base <= 9400000000:
	//			aggr_tax = aggr_tax_base*4/100 - 89400000;
	//			break;
	//		default: //94억초과
    //        aggr_tax = aggr_tax_base*5/100 - 183400000;
 	//	}
    //}

 

    //세액공제 - 보유기간 및 연령 2022년기준
    prd_dc = 0; age_dc = 0;
    if(one_o_one == "1세대1주택"){
     if(period < 5){ prd_dc = 0;}
     else if(period < 10){ prd_dc = 2/10;}
     else if(period < 15){ prd_dc = 4/10;}
     else { prd_dc = 5/10;}
    
     if(age < 60){ age_dc = 0;}
     else if(age < 65){ age_dc = 2/10;}
     else if(age < 70){ age_dc = 3/10;}
     else { age_dc = 4/10;}
    }

   // alert(prd_dc);
   // alert(age_dc);
    
    //종부대상주택재산세액의 계산
    //property_tax_dc = sum(2,n)*(sum_tax_base*0.6*0.004)/(sum(0,n)*0.6*0.004-630000);
    if(one_o_one == "1세대1주택" || one_o_one == "공동명의1주택") {p_real_rate = 0.45;}
    else {p_real_rate = 0.6;}
    property_tax_dc = property_tax*(aggr_tax_base*p_real_rate*0.004)/(gongsi*p_real_rate*0.004-630000);
    //alert(aggr_tax+"  "+property_tax_dc);
    
    //종합부동산세액 및 세액공제.2021년부터는 80%한도
    aggr_tax_final = Math.max((aggr_tax - property_tax_dc),0)*(1 - Math.min(prd_dc + age_dc, 8/10)); 
    
     //납부할 부동산 세액
     return [Math.floor(aggr_tax_final), Math.floor(aggr_tax_final*2/10)];
        
    }
    
    //------------------------------------------
    //
    // 양도소득세계산함수(아파트주택기준.추후 토지건물추가)
    //    2022/5/10-2023/5/9 기준으로 작성
    //     - 다주택양도소득세중과배제,다주택장기보유특별공제적용,보유거주재기산페지
    //
    // 입력: market_price 시가
    //       base_price 취득가액
    //       hold_period 보유기간, stay_period 거주기간
    //       IS_WVR "1세대1주택" "다주택"
    //       TYPE "주택" "건물" "토지" "비사업토지"
    //
    //------------------------------------------

function calc_sale_income_tax(market_price, base_price, hold_period, stay_period, IS_WVR, TYPE){

   //양도차익 = 양도가액-필요경비 
   var transfer_income = market_price - base_price; 

   //과세대상 양도차익 = 양도차익 - 비과세양도차익
   // 비과세양도차익조건: 주택만. 1세대1주택.2년이상보유.양도가액9억이하(9억고가주택은9억이하만)
    var waiver_income, taxable_income;
//alert(market_price);
    if(IS_WVR == "1세대1주택"){
        if(market_price >= 900000000){
		    taxable_income = transfer_income * (market_price - 900000000)/market_price;
		    waiver_income = transfer_income - taxable_income;
	    }
	    else{
		    taxable_income = 0;
		    waiver_income = transfer_income;
	    }
    }
    else {
        taxable_income = transfer_income;
        waiver_income = 0;
    }
//    alert(taxable_income);
//    alert(waiver_income);

    //장기보유특별공제.다주택자도포함
    var hold_deduct_rate, stay_deduct_rate, total_deduct_rate, y;

    if(IS_WVR == "1세대1주택"){
       if(stay_period < 2){ hold_deduct_rate = 0; stay_deduct_rate = 0; } //2년미만거주시공제안됨
	   else{
    	   	//보유기간
		   	if(hold_period < 3){ hold_deduct_rate = 0;y = '1주택,2년미만보유,';} else
			if(hold_period < 4){ hold_deduct_rate = 12;y = '1주택,3년보유,';} else
			if(hold_period < 5){ hold_deduct_rate = 16;y = '1주택,4년보유,';} else
			if(hold_period < 6){ hold_deduct_rate = 20;y = '1주택,5년보유,';} else
			if(hold_period < 7){ hold_deduct_rate = 24;y = '1주택,6년보유,';} else
			if(hold_period < 8){ hold_deduct_rate = 28;y = '1주택,7년보유,';} else
			if(hold_period < 9){ hold_deduct_rate = 32;y = '1주택,8년보유,';} else
			if(hold_period < 10){ hold_deduct_rate = 36;y = '1주택,9년보유,';} else
			{hold_deduct_rate = 40;y = '1주택,10년이상보유,';}

			//거주요건
			if(hold_period < 3){ stay_deduct_rate = 0;} //3년미만보유시 거주요건적용안됨
			else{
				if(stay_period <3){ stay_deduct_rate = 8;y = y + '2년거주';} else
				if(stay_period <4){ stay_deduct_rate = 12;y = y + '3년거주';} else
				if(stay_period <5){ stay_deduct_rate = 16;y = y + '4년거주';} else
				if(stay_period <6){ stay_deduct_rate = 20;y = y + '5년거주';} else
				if(stay_period <7){ stay_deduct_rate = 24;y = y + '6년거주';} else
				if(stay_period <8){ stay_deduct_rate = 28;y = y + '7년거주';} else
				if(stay_period <9){ stay_deduct_rate = 32;y = y + '8년거주';} else
				if(stay_period <10){ stay_deduct_rate = 36;y = y + '9년거주';} else
				{stay_deduct_rate = 40;y = y + '10년이상거주';}
			}
        }
    }
    else{ //다주택
        if(hold_period < 3) { hold_deduct_rate = 0;y = '3년미만';} else
		if(hold_period < 4) { hold_deduct_rate = 6;y = '3년이상 4년미만';}  else
		if(hold_period < 5) { hold_deduct_rate = 8;y = '4년이상 5년미만';} else
		if(hold_period < 6) { hold_deduct_rate = 10;y = '5년이상 6년미만';} else
		if(hold_period < 7) { hold_deduct_rate = 12;y = '6년이상 7년미만';} else
		if(hold_period < 8) { hold_deduct_rate = 14;y = '7년이상 8년미만';} else
		if(hold_period < 9) { hold_deduct_rate = 16;y = '8년이상 9년미만';} else
		if(hold_period < 10){ hold_deduct_rate = 18;y = '9년이상 10년미만';} else
		if(hold_period < 11){ hold_deduct_rate = 20;y = '10년이상 11년미만';} else
		if(hold_period < 12){ hold_deduct_rate = 22;y = '11년이상 12년미만';} else
		if(hold_period < 13){ hold_deduct_rate = 24;y = '12년이상 13년미만';} else
		if(hold_period < 14){ hold_deduct_rate = 26;y = '13년이상 14년미만';} else
		if(hold_period < 15){ hold_deduct_rate = 28;y = '14년이상 15년미만';} else
		if(hold_period>= 15){ hold_deduct_rate = 30;y = '15년이상';}

        stay_deduct_rate = 0; //다주택은 별도 거주요건없음
    }
	// 전체 공제율
	total_deduct_rate = hold_deduct_rate + stay_deduct_rate;
//alert(total_deduct_rate);
    //과세표준 = 과세대상양도차익 - 과세대상양도차익*공제율 - 양도소득기본공제
    var income_final = Math.max(taxable_income - taxable_income*total_deduct_rate*0.01 - 2500000,0);
//alert(income_final);
    //세율과  누진공제
    var base_r, base_dc; //기본세율 2023년 이후
    if(income_final <= 14000000){ base_r = 0.06;  base_dc = 0; } else 
	if(income_final <= 50000000){ base_r = 0.15;  base_dc = 1260000; } else
    if(income_final <= 88000000){ base_r = 0.24;  base_dc = 5760000; } else
	if(income_final <= 150000000){ base_r = 0.35; base_dc = 15440000; } else
	if(income_final <= 300000000){ base_r = 0.38; base_dc = 19940000; } else
	if(income_final <= 500000000){ base_r = 0.40; base_dc = 25940000; } else
	if(income_final <= 1000000000){ base_r = 0.42;base_dc = 35940000; }else 
	if(income_final > 1000000000){ base_r = 0.45; base_dc = 65940000; } 

    //---매년 개정시 기본세율 외 경합체크필요-----
    //토지의 지정지역(2018.1.1이후)은 입력값에 없으므로 제외
    // 현재는 2022.5.10 ~ 2023.5.9 한시적개정 반영되어있음
    var final_rate = base_r, final_dc = base_dc;
//alert(final_rate);
    // 경합1 - 보유기간 2년 미만시 중과세.단일세율
    var r1 = 0, total_tax1;
    if(TYPE == "주택"){
    	if(hold_period < 1){ r1 = 0.7;}
    	else if(hold_period < 2){ r1 = 0.6;}
    }
    else{
    	if(hold_period < 1){ r1 = 0.5;}
    	else if(hold_period < 2){ r1 = 0.4;}
    }	
    total_tax1 = income_final*r1; //단일세율이므로 누진공제없음

    //경합2 - 조정지역다주택처리배제.누진세율
    var r2 = 0, total_tax2;
    if(TYPE == "비사업토지"){ r2 = base_r + 0.1;} //비사업용 자체가 중과므로 경합에 넣음

    //if(con3 == 1){ //조정지역
  //    if(con0 == 2){ r2 = base_r + 0.2;} //2주택
  //   	if(con0 == 3){ r2 = base_r + 0.3;}  //3주택이상
  // }     

    total_tax2 = Math.max(income_final*r2 - final_dc,0);

    //경합처리. 둘다0일경우는 기본세율이므로 r,dc 재적용하지 않음
    if(total_tax1 != 0 || total_tax2 != 0){ 
    	if(total_tax1 > total_tax2){ final_rate = r1; final_dc = 0;}//단일세율 누진공제0으로 세팅
    	else{ final_rate = r2;}
    }
    //---end of 매년 개정시 기본세율 외 경합체크필요-----

    var transfer_tax, transfer_local_tax;
    transfer_tax = Math.max(income_final*final_rate-final_dc,0);
    transfer_local_tax = transfer_tax*0.1;

    return [Math.floor(transfer_tax), Math.floor(transfer_local_tax)];


}

//----------------------------------------------
//
// IncludeHTML()
//  html 소스 include
//
//------------------------------------------------
function IncludeHTML(file){
   // console.log('start include html');
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET",file,false);
    rawFile.onreadystatechange = function()
    {
        if(rawFile.readyState == 4)
        {
            if(rawFile.status == 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                document.write(allText);
            }
        }
    }
    rawFile.send(null);
}


