import styles from "../styles/TechStack.module.css"
export default function TechStack () {
    return (
        <>
            <div className={styles.techStackContainer}>
                <div className={styles.titleContainer}>
                    <h1 className={styles.title}>Tech Stack</h1>
                    <div className={styles.line}></div>
                </div>
                <ul className={styles.items}>
                    <li>
                        <div className="imageContainer">
                            <img src="images/react.png" alt="react" />
                        </div>
                    </li>
                    <li>
                        <img src="images/typescript.png" alt="typescript" />
                    </li>

                    <li>
                        <img src="images/python.png" alt="python" />
                    </li>
                    <li>
                        <img src="images/C.png" alt="c" />
                    </li>
                    <li>
                        <img src="images/java.png" alt="Java" />
                    </li>
                    <li>
                        <img src="images/sql.png" alt="SQL" />
                    </li>
                    <li>
                        <img src="images/flask.png" alt="flask" />
                    </li>
                </ul>
            </div>

        </>
    )
}



   