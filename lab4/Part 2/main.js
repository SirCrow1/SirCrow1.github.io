const displayedImage = document.querySelector(".displayed-img");
const thumbBar = document.querySelector(".thumb-bar");

const btn = document.querySelector("button");
const overlay = document.querySelector(".overlay");

const images = [
    { filename: 'pic1.jpg', alt: 'Closeup of a human eye' },
    { filename: 'pic2.jpg', alt: 'rock that looks like a wave' },
    { filename: 'pic3.jpg', alt: 'purple and white looks pansides' },
    { filename: 'pic4.jpg', alt: 'Section of wall from a pharioh tomb' },
    { filename: 'pic5.jpg', alt: 'Large moth on the leaf' }
];

const baseUrl = 'images/';

for (const image of images) {
    const newImage = document.createElement('img');
    newImage.setAttribute('src', `${baseUrl}${image.filename}`);
    newImage.setAttribute('alt', image.alt);
    newImage.setAttribute('tabindex', '0');
    thumbBar.appendChild(newImage);

    newImage.addEventListener('click', (e) => {
        updateDisplayImage(e.target);
    });

    newImage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            updateDisplayImage(e.target);
        }
    });
}

function updateDisplayImage(img) {
    displayedImage.src = img.src;
    displayedImage.alt = img.alt;
}

btn.addEventListener('click', () => {
    const btnClass = btn.getAttribute('class');

    if (btnClass === 'dark') {
        btn.setAttribute('class', 'light');
        btn.textContent = 'Lighten';
        overlay.style.backgroundColor = 'rgb(0 0 0 / 0.5)';
    } else {
        btn.setAttribute('class', 'dark');
        btn.textContent = 'Darken';
        overlay.style.backgroundColor = 'rgb(0 0 0 / 0)';
    }
});