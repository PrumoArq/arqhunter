/* ARQHunter — JS leve compartilhado dos templates.
   Nav sticky, menu mobile, reveal no scroll e count-up. Sem libs. */
(function(){
  "use strict";
  var nav=document.querySelector(".nav");
  if(nav){
    var onScroll=function(){nav.classList.toggle("is-stuck",window.scrollY>8)};
    onScroll();window.addEventListener("scroll",onScroll,{passive:true});
    var burger=nav.querySelector(".nav__burger"),links=nav.querySelector(".nav__links");
    if(burger&&links){
      burger.addEventListener("click",function(){links.classList.toggle("open")});
      links.addEventListener("click",function(e){if(e.target.closest("a"))links.classList.remove("open")});
    }
  }
  /* reveal no scroll */
  var reveals=document.querySelectorAll(".reveal");
  if("IntersectionObserver"in window&&reveals.length){
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(en){if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target)}})
    },{threshold:.14,rootMargin:"0px 0px -8% 0px"});
    reveals.forEach(function(el){io.observe(el)});
  }else{reveals.forEach(function(el){el.classList.add("in")})}
  /* count-up */
  var nums=document.querySelectorAll("[data-count]");
  if("IntersectionObserver"in window&&nums.length){
    var cio=new IntersectionObserver(function(ents){
      ents.forEach(function(en){
        if(!en.isIntersecting)return;cio.unobserve(en.target);
        var el=en.target,end=parseFloat(el.getAttribute("data-count")),
            dec=(el.getAttribute("data-dec")||"0")|0,
            pre=el.getAttribute("data-pre")||"",suf=el.getAttribute("data-suf")||"",
            t0=null,dur=1400;
        function step(ts){
          if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1),e=1-Math.pow(1-p,3),v=end*e;
          el.textContent=pre+v.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;
          if(p<1)requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      })
    },{threshold:.5});
    nums.forEach(function(el){cio.observe(el)});
  }
})();
