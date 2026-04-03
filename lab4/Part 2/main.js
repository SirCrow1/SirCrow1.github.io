const displayedImage = document.querySelector(".displayed-img");
const thumbBar = document.querySelector(".thumb-bar");

const btn = document.querySelector("button");
const overlay = document.querySelector(".overlay");


const = images [
    { fillename: 'pic1.jpg' alt: 'Closeup of a human eye'},
    { fillename: 'pic2.jpg' alt: 'rock that looks like a wave'},
    { fillename: 'pic3.jpg' alt: 'purple and white looks pansides'},
    { fillename: 'pic4.jpg' alt: 'Section of wall from a pharioh tomb'},
    { fillename: 'pic5.jpg' alt: 'Large moth on the leaf'},]
    const baseUrl = 'images/';

    for(const image of images) 
        const newImage = document.createElmement('img');
    newImage.setAttribute('src', '$baseUrl}${image.filename}');
    newImage.setAttribute ("alt, image.alt");
    newImage.setAttribute('tabindex' '0');
    thumbBar.appendChild(newImages)

newImage.addEventListener('click',(e) => {
    updateDisplayImage(e.target);});  
    
newImage.addEventListener('keydown, (e)=>
    { if(e.key==='Enter'){
        updateDisplayImage(e.target);
        }
  });
}
