(()=>{var d=e=>{mapboxgl.accessToken="pk.eyJ1IjoiZGstY2hldmFsaWVyIiwiYSI6ImNsbWEzOGp0aTBnbGkzZG1iODM1d2s3NXQifQ.V9FthG8gHIqpquI4a6G4yw";let t=new mapboxgl.Map({container:"map",style:"mapbox://styles/dk-chevalier/clma4g4xe012a01qz2p3pcolh",scrollZoom:!1}),o=new mapboxgl.LngLatBounds;e.forEach(a=>{let n=document.createElement("div");n.className="marker",new mapboxgl.Marker({element:n,anchor:"bottom"}).setLngLat(a.coordinates).addTo(t),new mapboxgl.Popup({offset:30}).setLngLat(a.coordinates).setHTML(`<p>Day ${a.day}: ${a.description}</p>`).addTo(t),o.extend(a.coordinates)}),t.fitBounds(o,{padding:{top:200,bottom:150,left:100,right:100}})};var c=()=>{let e=document.querySelector(".alert");e&&e.parentElement.removeChild(e)},s=(e,t)=>{c();let o=`<div class="alert alert--${e}">${t}</div>`;document.querySelector("body").insertAdjacentHTML("afterbegin",o),window.setTimeout(c,5e3)};var i=async(e,t)=>{try{(await axios({method:"POST",url:"/api/v1/users/login",data:{email:e,password:t}})).data.status==="success"&&(s("success","Logged in successfully!"),window.setTimeout(()=>{location.assign("/")},1500))}catch(o){s("error",o.response.data.message)}},m=async()=>{try{(await axios({method:"GET",url:"/api/v1/users/logout"})).data.status==="success"&&location.reload(!0)}catch(e){console.log(e.response),s("error","Error logging out! Try again.")}};var r=async(e,t)=>{try{let o=t==="password"?"/api/v1/users/updateMyPassword":"/api/v1/users/updateMe";(await axios({method:"PATCH",url:o,data:e})).data.status==="success"&&s("success",`${t.toUpperCase()} updated successfully!`)}catch(o){s("error",o.response.data.message)}};var v=Stripe("pk_test_51O0ErwLaaxuYLkeOYCYW1Ad7tcmEfOJwLmt3JpQOUPGn5bbw4q9nblbZ0XhD6a0crrsV8361XTq4qlJ2GOlNiVQi00YSKm0Kru"),l=async e=>{try{let t=await axios(`/api/v1/bookings/checkout-session/${e}`);await v.redirectToCheckout({sessionId:t.data.session.id})}catch(t){console.log(t),s("error",t)}};var u=document.getElementById("map"),p=document.querySelector(".form--login"),g=document.querySelector(".nav__el--logout"),w=document.querySelector(".form-user-data"),y=document.querySelector(".form-user-password"),f=document.getElementById("book-tour");if(u){let e=JSON.parse(u.dataset.locations);d(e)}p&&p.addEventListener("submit",e=>{e.preventDefault();let t=document.getElementById("email").value,o=document.getElementById("password").value;i(t,o)});g&&g.addEventListener("click",m);w&&w.addEventListener("submit",e=>{e.preventDefault();let t=new FormData;t.append("name",document.getElementById("name").value),t.append("email",document.getElementById("email").value),t.append("photo",document.getElementById("photo").files[0]),r(t,"data")});y&&y.addEventListener("submit",async e=>{e.preventDefault(),document.querySelector(".btn--save-password").textContent="Updating...";let t=document.getElementById("password-current").value,o=document.getElementById("password").value,a=document.getElementById("password-confirm").value;await r({passwordCurrent:t,password:o,passwordConfirm:a},"password"),document.querySelector(".btn--save-password").textContent="Save password",document.getElementById("password-current").value="",document.getElementById("password").value="",document.getElementById("password-confirm").value=""});f&&f.addEventListener("click",e=>{e.target.textContent="Processing...";let{tourId:t}=e.target.dataset;l(t)});})();
