import React from 'react';
import Typed from 'typed.js';
import styles from '../styles/home.module.css';
import TechStack from './TechStack';

export default function Home() {
    // Create reference to store the DOM element containing the animation
    const el = React.useRef(null);
    React.useEffect(() => {
        const typed = new Typed(el.current, {
            // strings: ['Computer Science Student', 'Full Stack Developer', 'Aspiring Entreprenur'],
            strings: ['Computer Science Student'], 
            typeSpeed: 80,
            backSpeed: 10,
            startDelay: 1000,
            loop: false,
        });
        return () => {
            // Destroy Typed instance during cleanup to stop animation
            typed.destroy();
        };
    }, []);

    return (
        <>
            <div className={styles.aboutMe}>
                <div className={styles.imageContainer}>
                    {/* <img className={styles.asahi} src="public/images/asahi2.jpg" /> */}
                </div>
                <div className={styles.content}>
                    <h1 className={styles.intro}>Hi! MY NAME IS ASAHI</h1>
                    <h1 className={styles.intro}>I am a ... </h1>
                    <span className={styles.title} ref={el} />
                    <p className={styles.description}>Hi! My name is Asahi (Ash) Kuroki and I am a student at University of Minnesota, Twins cities</p>
                    <div className={styles.iconContainer}>
                        <div className={styles.icon}>
                            <a href="https://www.linkedin.com/in/asahi-kuroki/" target="_blank">
                                <img className={styles.icon} src="images/linkedin.png" />
                            </a>
                        </div>
                        <div className={styles.icon}>
                            <a href="https://github.com/kurokiasahi222" target="_blank">
                                <img className={styles.icon} src="images/github.png" />
                            </a>
                        </div>
                    </div>
                    <TechStack />
                </div>
            </div>
        </>
    );
}