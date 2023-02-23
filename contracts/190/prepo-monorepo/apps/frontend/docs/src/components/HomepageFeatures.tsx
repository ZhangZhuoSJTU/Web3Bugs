/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react'
import clsx from 'clsx'
import styles from './HomepageFeatures.module.css'

type FeatureItem = {
  title: string
  image: string
  description: JSX.Element
}

const FeatureList: FeatureItem[] = [
  {
    title: 'What is prePO?',
    image: '/img/undraw_docusaurus_mountain.svg',
    description: (
      <>
        Docusaurus was designed from the ground up to be easily installed and used to get your
        website up and running quickly.
      </>
    ),
  },
  {
    title: 'Core Concepts',
    image: '/img/undraw_docusaurus_tree.svg',
    description: (
      <>
        Docusaurus lets you focus on your docs, and we&apos;ll do the chores. Go ahead and move your
        docs into the <code>docs</code> directory.
      </>
    ),
  },
  {
    title: 'Tokenomics',
    image: '/img/undraw_docusaurus_react.svg',
    description: (
      <>
        Extend or customize your website layout by reusing React. Docusaurus can be extended while
        reusing the same header and footer.
      </>
    ),
  },
]

const Feature: React.FC<FeatureItem> = ({ title, image, description }) => (
  <div className={clsx('col col--4')}>
    <div className="text--center">
      <img className={styles.featureSvg} alt={title} src={image} />
    </div>
    <div className="text--center padding-horiz--md">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </div>
)

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
