import React, { FC, useEffect, useRef } from 'react'
import { useIsLargeScreen } from '../../hooks/useIsLargeScreen'
import { angels, investors } from '../../lib/partners'
import { BasicCarousel, BasicCarouselItemsProps } from '../carousel'
import { Icon, IconName } from '../Icon'
import { IntroContainer, IntroTrail } from '../intro'
import SectionTitle from '../SectionTitle'

export type Partner = {
  name: string
  description?: string
  url?: string
  iconName?: IconName
  imageUrl?: string
}

const flexSizeForCount = {
  4: 'text-xs flex-[0_0_calc(33.333%-10px)] lg:flex-[0_0_calc(25%-24px)] 2xl:flex-[0_0_calc(25%-38px)]',
  6: 'text-xs flex-[0_0_calc(33.333%-10px)] lg:flex-[0_0_calc(16.6%-24px)] 2xl:flex-[0_0_calc(16.6%-38px)]',
  8: 'text-xs flex-[0_0_calc(33.333%-10px)] lg:flex-[0_0_calc(12.5%-24px)] 2xl:flex-[0_0_calc(12.5%-38px)]',
}

type GroupedPartnerProps = {
  id: string
  active: boolean
  countPerRow?: keyof typeof flexSizeForCount
  showName?: boolean
  partners: Partner[]
  hasMore?: boolean
}

type MobilePartnersLists = { id: number; partners: Partner[] }[]
type ResponsiveGroupedPartnersProps = {
  countPerPage: number
  countPerRow: keyof typeof flexSizeForCount
} & Omit<GroupedPartnerProps, 'active' | 'id'>

const OtherText: React.FC = ({ children }) => (
  <div className="block h-full">
    <div className="flex justify-center items-center w-full h-full">
      <p className="text-xs font-semibold text-black xs:text-sm lg:text-base">{children}</p>
    </div>
  </div>
)

const PartnerCircle: React.FC<{ showName?: boolean; id: string } & Partner> = ({
  id,
  showName,
  name,
  description,
  iconName,
  imageUrl,
  url,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const or = new ResizeObserver((entries) => {
      // eslint-disable-next-line no-restricted-syntax
      entries.forEach((entry) => {
        const cr = entry.contentRect
        container.style.width = `${cr.height + cr.x + cr.y}px`
      })
    })
    or.observe(container)

    return (): void => {
      or.unobserve(container)
    }
  })

  return (
    <a href={url} target="_blank" rel="noreferrer" className="w-full">
      {/* pt-[100%] will reserve height same as width for the image so we get absolute circle */}
      <div className={`relative ${showName ? 'pt-[60%]' : 'pt-[100%]'}`}>
        <div className="flex absolute top-0 left-0 justify-center items-center w-full h-full">
          <div
            ref={containerRef}
            className="overflow-hidden top-0 left-0 p-[2px] h-full bg-prepo/5 rounded-full duration-300 hover:scale-110 lg:p-[3px]"
          >
            {iconName !== undefined && (
              <Icon id={id} name={iconName} className="w-full h-full rounded-full" />
            )}
            {imageUrl !== undefined && (
              <img
                className="object-contain w-full h-full rounded-full"
                alt={description}
                src={imageUrl}
              />
            )}
          </div>
        </div>
      </div>
      {showName && (
        <div className="mt-[6px] text-center">
          <p className="text-[11px] font-bold text-[#262626] xs:text-sm lg:text-base">{name}</p>
          <p className="text-[9px] font-medium text-[#7C89A0] xs:text-xs lg:text-sm">
            {description}
          </p>
        </div>
      )}
    </a>
  )
}

const GroupedPartners: React.FC<GroupedPartnerProps> = ({
  id,
  active,
  countPerRow = 4,
  hasMore,
  showName,
  partners,
}) => {
  const isLargeScreen = useIsLargeScreen()
  return (
    <div className="flex flex-col justify-center items-center w-full lg:pt-14">
      <div
        className={`flex flex-wrap gap-[10px] gap-y-5 w-full lg:gap-[24px] lg:gap-y-[24px] 2xl:gap-[38px] 2xl:gap-y-[38px] lg:px-6 ${
          !showName && 'justify-center'
        }`}
      >
        <IntroTrail
          appearAt={isLargeScreen ? 0.9 : 1}
          trailProps={{
            config: { tension: isLargeScreen ? 420 : 300, mass: 1 },
            transform: active ? 'scale(1)' : 'scale(0.01)',
            from: { transform: 'scale(0.01)' },
          }}
          componentClassName={`w-full ${flexSizeForCount[countPerRow]}`}
          keys={partners
            .map(({ name }) => name)
            .concat(hasMore ? 'and-more' : '')
            .filter(Boolean)}
        >
          {partners.map(({ iconName, name, description, url, imageUrl }) => (
            <PartnerCircle
              id={`${id}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
              key={name}
              showName={showName}
              name={name}
              description={description}
              iconName={iconName}
              imageUrl={imageUrl}
              url={url}
            />
          ))}
          {hasMore && <OtherText key="and-more">and many more...</OtherText>}
        </IntroTrail>
      </div>
    </div>
  )
}

const ResponsiveGroupedPartners: React.FC<ResponsiveGroupedPartnersProps> = ({
  partners,
  countPerPage,
  ...props
}) => {
  const mobileLists: MobilePartnersLists = []

  const loopCount = Math.ceil(partners.length / countPerPage)
  let start = 0
  while (mobileLists.length !== loopCount) {
    const newStart = start + countPerPage
    mobileLists.push({
      id: newStart,
      partners: partners.slice(start, newStart),
    })
    start = newStart
  }

  return (
    <div className="py-2">
      <div className="hidden lg:flex">
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <GroupedPartners id="desktop" active partners={partners} {...props} />
      </div>
      <div className="lg:hidden">
        <BasicCarousel
          items={(activeIndex: number): BasicCarouselItemsProps[] =>
            mobileLists.map(({ id, partners: partitionedPartners }, index) => ({
              id,
              content: (
                <GroupedPartners
                  active={activeIndex === index}
                  key={id}
                  id="mobile"
                  partners={partitionedPartners}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...props}
                  hasMore={props.hasMore && index === mobileLists.length - 1}
                />
              ),
            }))
          }
        />
      </div>
    </div>
  )
}

export const InvestorsSection: FC = () => (
  <section className="container px-4 pt-[54px] pb-10 mx-auto max-w-[1440px] text-center sm:px-8 lg:px-14 lg:pt-[78px] lg:pb-[92px] lg:max-w-">
    <div className="flex flex-col gap-y-11 mt-10">
      <IntroContainer>
        <SectionTitle>prePO Investors</SectionTitle>
        <ResponsiveGroupedPartners partners={investors} countPerPage={9} countPerRow={8} />
      </IntroContainer>
      <IntroContainer>
        <ResponsiveGroupedPartners
          partners={angels}
          countPerPage={9}
          countPerRow={6}
          showName
          hasMore
        />
      </IntroContainer>
    </div>
  </section>
)
