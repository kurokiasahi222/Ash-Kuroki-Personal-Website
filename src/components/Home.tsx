import React from 'react';
import Typed from 'typed.js';
import styles from '../styles/home.module.scss';

export default function Home() {
    // Create reference to store the DOM element containing the animation
    const el = React.useRef(null);
    React.useEffect(() => {
        const typed = new Typed(el.current, {
            // strings: ['Full Stack Developer', 'AI Enginner', 'Software Developer'],
            strings: ['Software Developer'], 
            typeSpeed: 80,
            backSpeed: 10,
            startDelay: 1000,
            loop: false,
            showCursor: false,
        });
        return () => {
            // Destroy Typed instance during cleanup to stop animation
            typed.destroy();
        };
    }, []);

    return (
        <div>
            <div className={styles.container}>
                <div className={styles.aboutMe}>
                    {/* <div className={styles.centerLine}></div> */}
                    <div className={styles.content}>
                        <div className={styles.intro}>
                            <h1>Hi! I'm </h1>
                            <h1 className={styles.name}>ASH (Asahi)</h1>
                        </div>
                        <span className={styles.title} ref={el} />
                        <p className={styles.description}>
                            I'm a <b>Full Stack Developer </b>based in Minneapolis. I love working in all aspect of tech stack from frontend to backend to AI.
                            <br />
                            <br />
                            Website designed by <a className={styles.link} href="https://www.kaylafpurney.com">Kayla Purney</a>
                            <br></br>Developed by <b>Ash Kuroki</b> using <i><a className={styles.link} href="https://astro.build/">Astro.js </a></i> & <i><a className={styles.link} href="https://alvarotrigo.com/fullPage/">fullPage.js</a></i>
                        </p>
                    </div>
                    <div className={styles.imageContainer} >
                        <img className={styles.ashImg} src="../../images/asahi-headshot.webp" alt="asahi-headshot" />
                    </div>
                </div>
            </div>
        </div>
    );
}