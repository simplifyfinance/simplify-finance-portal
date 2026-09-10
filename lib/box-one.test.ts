import { describe, it, expect } from 'vitest'
import { boxOne, variantOf, structureOf, flexibilityPassage, lendersLine, andList } from './box-one'

// A REAL DEAL'S SHAPE, WITH NOBODY'S REAL DETAILS.
//
// Taken field for field off a live upgrader file - two applicants, one earning
// and one not, a property recorded as being sold, two lender options, and the
// fact find purpose left blank, because that is the case that matters. Every
// name, address, email and account number has been replaced. A client's details
// do not belong in a repository.
const DEAL: any = {
  "bc_data": {
    "lmi": "",
    "lvr": "80%",
    "fhog": "",
    "hecs": "",
    "brand": "simplify",
    "joint": "Yes",
    "health": "",
    "living": "",
    "splits": [
      {
        "rate": "5.99",
        "type": "P&I",
        "label": "Owner-occupied loan",
        "amount": "1,700,000",
        "repayment": "10182"
      }
    ],
    "suburb": "NSW",
    "carLoan": "",
    "ccLimit": "",
    "deposit": "3,841,500",
    "lastName": "Fielding",
    "loanTerm": "30",
    "template": "oo_purchase",
    "agentFees": "",
    "brokerSig": "kylie",
    "checklist": [],
    "dutyState": "NSW",
    "firstName": "Rachel",
    "landValue": "",
    "lvrCustom": "",
    "salePrice": "",
    "stampDuty": "291,500",
    "dependants": "2",
    "incomeBase": 0,
    "lvrPercent": 32.4,
    "brokerNotes": "",
    "incomeOther": "",
    "netProceeds": 0,
    "optionLabel": "",
    "altScenarios": [],
    "incomeRental": "",
    "personalLoan": "",
    "propertyType": "Owner-occupied",
    "depositSource": "Savings",
    "equityRelease": "",
    "guarantorName": "",
    "internalNotes": "",
    "lmiApplicable": "",
    "propertyValue": "",
    "purchasePrice": "5,250,000",
    "templateNotes": "",
    "bridgingPeriod": "",
    "compareOptions": false,
    "existingLoanBal": "1279283.98",
    "constructionCost": "",
    "newPurchasePrice": "",
    "additionalSavings": "",
    "asIfCompleteValue": "",
    "emailHtmlTemplate": "",
    "newPurchaseSuburb": "",
    "newPurchaseDeposit": "",
    "newPurchaseLoanTerm": "30",
    "newPurchaseStampDuty": "",
    "newPurchasePropertyType": "Owner-occupied",
    "purchasePropertySubtype": "",
    "newPurchaseDepositSource": ""
  },
  "lo_data": {
    "joint": "Yes",
    "brandId": "simplify",
    "deposit": "3,841,500",
    "lenders": [
      {
        "fixedIO": {
          "rate": "",
          "enabled": false,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "",
          "fixedYears": "2"
        },
        "fixedPI": {
          "rate": "",
          "enabled": false,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "",
          "fixedYears": "2"
        },
        "legalFee": "350",
        "lenderId": "a1000000-0000-0000-0000-000000000010",
        "annualFee": "$299/yr",
        "maxEquity": "",
        "lenderName": "ING",
        "monthlyFee": "",
        "variableIO": {
          "rate": "",
          "enabled": false,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "",
          "fixedYears": "2"
        },
        "variablePI": {
          "rate": "5.99",
          "enabled": true,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "10,182",
          "fixedYears": "2"
        },
        "productName": "Orange Advantage",
        "rateLockFee": "",
        "specialNote": "One offset per loan account up to 4 loan accounts under the package",
        "approvalDays": "1-2 business days",
        "bridgingRate": "",
        "bridgingTerm": "12",
        "dischargeFee": "",
        "lenderSplits": [],
        "libraryNotes": "Anneual fee waived with $1000+/month deposit",
        "valuationFee": "$0",
        "offsetAccount": "Yes",
        "applicationFee": "$0",
        "lenderProductId": "e705ac3b-86a8-4bd4-a906-9be4ee928fd5",
        "docProcessingFee": "",
        "establishmentFee": "",
        "earlyRepaymentFee": "",
        "estimatedInterest": "",
        "bridgingLoanAmount": ""
      },
      {
        "fixedIO": {
          "rate": "",
          "enabled": false,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "",
          "fixedYears": "2"
        },
        "fixedPI": {
          "rate": "",
          "enabled": false,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "",
          "fixedYears": "2"
        },
        "legalFee": "200",
        "lenderId": "a1000000-0000-0000-0000-000000000002",
        "annualFee": "$395/yr",
        "maxEquity": "",
        "lenderName": "CBA",
        "monthlyFee": "",
        "variableIO": {
          "rate": "",
          "enabled": false,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "",
          "fixedYears": "2"
        },
        "variablePI": {
          "rate": "6.07",
          "enabled": true,
          "ioYears": "5",
          "loanTerm": "30",
          "repayment": "10,269",
          "fixedYears": "2"
        },
        "productName": "Wealth Package",
        "rateLockFee": "",
        "specialNote": "Your borrowing structure and temporary visa is subject to upfront bank approval (we should hear within 1 business day)",
        "approvalDays": "1-2 business days",
        "bridgingRate": "",
        "bridgingTerm": "12",
        "dischargeFee": "",
        "lenderSplits": [
          {
            "id": "3b9dc57c-8819-4ed7-9e25-1cb3048ce0fd",
            "lvr": "",
            "rate": "",
            "label": "Owner-occupied loan",
            "amount": "",
            "repayment": "",
            "repaymentType": "P&I"
          }
        ],
        "libraryNotes": "Package product \u2014 offset on variable only",
        "valuationFee": "$0",
        "offsetAccount": "Yes",
        "applicationFee": "$0",
        "lenderProductId": "1f17e38c-f21b-4dd8-8b70-73824c7be8bf",
        "docProcessingFee": "",
        "establishmentFee": "",
        "earlyRepaymentFee": "",
        "estimatedInterest": "",
        "bridgingLoanAmount": ""
      }
    ],
    "lastName": "Fielding",
    "template": "lo_purchase",
    "brokerSig": "kylie",
    "dutyState": "NSW",
    "firstName": "Rachel",
    "stampDuty": "291,500",
    "bcTemplate": "oo_purchase",
    "loanAmount": "1,700,000",
    "criteriaUsed": [
      "Competitive interest rate",
      "Good turnaround times",
      "Ability to have an offset account",
      "Fully assessed pre-approval applications"
    ],
    "existingLoan": "",
    "internalNotes": "We have finalised some lending options for you to select from as you are looking at upgrading your owner-occupied home. Your existing home will be sold and settled prior to OR simultaneously with the new purchase. ",
    "jointLastName": "Fielding",
    "purchasePrice": "5,250,000",
    "importantNotes": "Any rates or fees quoted are subject to change\nThis email does not constitute as a formal approval",
    "jointFirstName": "Daniel",
    "additionalNotes": "",
    "refinanceSplits": [
      {
        "id": "3b9dc57c-8819-4ed7-9e25-1cb3048ce0fd",
        "label": "Owner-occupied loan",
        "amount": "",
        "purpose": "OO"
      }
    ],
    "documentsRequired": [
      "Copy of current passport (Daniel). The one we hold has expired",
      "Copy of current subclass visa 461 (Daniel). The one we hold has expired"
    ],
    "recommendedLender": "ING",
    "clientAgreedLender": "",
    "clientChosenLender": "",
    "recommendationNote": "They offer the most competitive variable rate (5.99% P&I) with annual fee. ING are flexible with a temporary visa holder when you are borrowing with a spouse who is a permanent resident of Australia. ",
    "brokerPersonalisation": "We have finalised some lending options for you to select from as you are looking at upgrading your owner-occupied home. Your existing home will be sold and settled prior to OR simultaneously with the new purchase. ",
    "clientChosenLenderOther": "",
    "clientChosenLenderReason": ""
  },
  "compliance_data": {
    "risks": {
      "Rachel Fielding": {
        "hasWill": "Yes",
        "jobSecurity": "Medium",
        "emergencyFund": "Yes",
        "retirementAge": "75",
        "adverseChanges": "No",
        "loanFlexibility": "Medium",
        "repaymentMethod": "Downsizing home",
        "declaredBankrupt": "No",
        "adequateInsurance": "Yes",
        "beneficialChanges": "No",
        "maintainLifestyle": "Yes",
        "circumstancesImpact": "No",
        "financialExperience": "High",
        "interestRateConcern": "Medium",
        "officerInLiquidation": "No",
        "propertyValueConcern": "Medium",
        "unsatisfiedJudgements": "No",
        "simultaneousApplications": "No",
        "problemsMeetingCommitments": "No"
      }
    },
    "applicants": [
      {
        "name": "Rachel Fielding",
        "type": "applicant"
      }
    ],
    "entityType": "Individual(s)",
    "preApproval": true,
    "productReqs": {
      "redraw": "Important",
      "fixedRate": "Not important",
      "lowestCost": "Somewhat important",
      "interestOnly": "Not important",
      "lenderPolicy": "Somewhat important",
      "lineOfCredit": "Do not want",
      "variableRate": "Important",
      "offsetAccount": "Important",
      "approvedQuickly": "Somewhat important",
      "branchFrequency": "Rarely",
      "fixedAndVariable": "Important",
      "specificFeatures": "Somewhat important",
      "interestInAdvance": "Do not want",
      "otherRequirements": "",
      "principalAndInterest": "Important"
    },
    "requirementsType": "Owner occupied",
    "clientAgreedLender": "",
    "clientChosenLender": "",
    "clientChosenLenderOther": "",
    "clientChosenLenderReason": "",
    "securityComment": "TBA \u2014 owner-occupied residential property, NSW."
  },
  "fact_find_data": {
    "assets": [
      {
        "id": "21519eca-d7a0-471d-8842-883112b57548",
        "bsb": "",
        "value": "50000",
        "assetType": "Super",
        "ownership": {
          "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "Yes"
        },
        "regNumber": "",
        "description": "Superannuation balance - Applicant 1",
        "accountNumber": "",
        "membershipNumber": ""
      },
      {
        "id": "b54e11dd-3e90-4c35-b262-f4b0401a8062",
        "bsb": "",
        "value": "700000",
        "assetType": "Super",
        "ownership": {
          "a53e77d9-5260-46d0-91ab-01fd52066c10": "Yes"
        },
        "regNumber": "",
        "description": "Superannuation balance - Applicant 2",
        "accountNumber": "",
        "membershipNumber": ""
      },
      {
        "id": "0531839b-9247-4ce2-b43a-40b78518adee",
        "bsb": "",
        "value": "50000",
        "assetType": "Vehicle",
        "ownership": {
          "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "Yes"
        },
        "regNumber": "",
        "description": "Mazda CX-9 - Applicant 1",
        "accountNumber": "",
        "membershipNumber": ""
      },
      {
        "id": "29733854-b284-4dff-ae38-cac0766118df",
        "bsb": "",
        "value": "30000",
        "assetType": "Vehicle",
        "ownership": {
          "a53e77d9-5260-46d0-91ab-01fd52066c10": "Yes"
        },
        "regNumber": "",
        "description": "Mazda 3 - Applicant 2",
        "accountNumber": "",
        "membershipNumber": ""
      },
      {
        "id": "19164ccc-f255-4e82-9009-94b064181425",
        "bsb": "",
        "value": "400000",
        "assetType": "Shares",
        "ownership": {
          "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "Yes"
        },
        "regNumber": "",
        "description": "Shares - Applicant 1",
        "accountNumber": "",
        "membershipNumber": ""
      },
      {
        "id": "1d5e3196-80f9-4be7-98a0-62cc27985ee8",
        "bsb": "",
        "value": "1700000",
        "assetType": "Bank account",
        "ownership": {
          "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "Yes",
          "a53e77d9-5260-46d0-91ab-01fd52066c10": "Yes"
        },
        "regNumber": "",
        "description": "Savings ",
        "accountNumber": "",
        "membershipNumber": ""
      },
      {
        "id": "e1ec4d1a-1ee0-42eb-a3b2-b738801e6bc4",
        "bsb": "",
        "value": "470000",
        "assetType": "Bank account",
        "ownership": {
          "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "Yes",
          "a53e77d9-5260-46d0-91ab-01fd52066c10": "Yes"
        },
        "regNumber": "",
        "description": "Savings account - Applicant 2",
        "accountNumber": "",
        "membershipNumber": ""
      }
    ],
    "applicants": [
      {
        "id": "771e8c5d-f7e5-48e2-b863-d3ad715d9471",
        "dob": "1979-05-15",
        "title": "Mrs",
        "gender": "",
        "income": [
          {
            "incomeType": "Base salary",
            "grossSalary": "",
            "grossSalaryFrequency": "Anneually"
          }
        ],
        "lastName": "Fielding",
        "addresses": [
          {
            "id": "ddae103d-1957-4fff-9949-f6e3e51f7ccf",
            "address": "14 Sample Street, Suburbia NSW 2000",
            "endDate": "",
            "isCurrent": true,
            "startDate": "2022-02-01",
            "residentialStatus": "Owner",
            "housingExpenseAmount": "",
            "housingExpenseFrequency": "Weekly"
          },
          {
            "id": "2c43fc4b-ccde-4cd1-aa26-1ae44fef6dd1",
            "address": "9 Prior Street, Suburbia NSW 2000",
            "endDate": "",
            "isCurrent": false,
            "startDate": "2021-03-01",
            "residentialStatus": "Owner",
            "housingExpenseAmount": "",
            "housingExpenseFrequency": "Weekly"
          }
        ],
        "firstName": "Rachel",
        "employment": [
          {
            "id": "61fb3a74-f3f9-43d0-8e11-28f09e47b3cd",
            "endDate": "",
            "isCurrent": true,
            "startDate": "2026-09-02",
            "occupation": "Domestic duties",
            "employerAbn": "",
            "employerAcn": "",
            "onProbation": false,
            "employerName": "",
            "employerType": "",
            "employmentType": "Not working",
            "employerAddress": "",
            "employmentBasis": "",
            "contactPersonName": "",
            "employmentPriority": "Primary",
            "contactPersonDetails": ""
          }
        ],
        "middleName": "Anne",
        "phoneMobile": "0400000001",
        "previousName": "",
        "emailPersonal": "two@example.com",
        "preferredName": ""
      },
      {
        "id": "a53e77d9-5260-46d0-91ab-01fd52066c10",
        "dob": "1981-03-11",
        "title": "Mr",
        "gender": "Male",
        "income": [
          {
            "id": "776cf614-adfb-4db7-bcbb-efd8d180e0c6",
            "seAbn": "",
            "seYear1FY": "2023/24",
            "seYear2FY": "2024/25",
            "incomeType": "PAYG",
            "bonusAmount": "",
            "grossSalary": "446428.63",
            "employmentId": "05860620-9acd-4aa4-b24a-729e7dfc3009",
            "seYear1Other": "",
            "seYear1Super": "",
            "seYear2Other": "",
            "seYear2Super": "",
            "seYear1OneOff": "",
            "seYear1Salary": "",
            "seYear2OneOff": "",
            "seYear2Salary": "",
            "bonusFrequency": "Anneually",
            "seBusinessName": "",
            "seGrowthMethod": "average",
            "allowanceAmount": "",
            "otherIncomeType": "",
            "seYear1Interest": "",
            "seYear2Interest": "",
            "commissionAmount": "",
            "seDirectorSalary": "",
            "seYear1NetProfit": "",
            "seYear2NetProfit": "",
            "otherIncomeAmount": "",
            "allowanceFrequency": "Anneually",
            "seAssessmentMethod": "Last 2 financial years",
            "commissionFrequency": "Anneually",
            "seYear1Depreciation": "",
            "seYear2Depreciation": "",
            "grossSalaryFrequency": "Anneually",
            "seDirectorProfitable": "Yes",
            "seGrowthPercentCustom": "",
            "seGrowthPercentOption": "20",
            "overtimeEssentialAmount": "",
            "seDirectorSalaryFrequency": "Anneually",
            "overtimeEssentialFrequency": "Anneually",
            "overtimeNonEssentialAmount": "",
            "overtimeNonEssentialFrequency": "Anneually"
          }
        ],
        "lastName": "Fielding",
        "addresses": [
          {
            "id": "0156f13b-5566-4e6c-b8f9-3d2bd7468236",
            "address": "14 Sample Street, Suburbia NSW 2000",
            "endDate": "",
            "isCurrent": true,
            "startDate": "2022-02-01",
            "residentialStatus": "Owner",
            "housingExpenseAmount": "",
            "housingExpenseFrequency": "Weekly"
          }
        ],
        "firstName": "Daniel",
        "employment": [
          {
            "id": "05860620-9acd-4aa4-b24a-729e7dfc3009",
            "endDate": "",
            "isCurrent": true,
            "startDate": "2025-04-30",
            "occupation": "Investment manager",
            "employerAbn": "",
            "employerAcn": "",
            "onProbation": false,
            "employerName": "New job",
            "employerType": "",
            "employmentType": "PAYG",
            "employerAddress": "",
            "employmentBasis": "Full time",
            "contactPersonName": "",
            "employmentPriority": "Primary",
            "contactPersonDetails": ""
          },
          {
            "id": "7f24901c-1682-46d7-a8bf-3ab2a8dd3999",
            "endDate": "2024-02-01",
            "isCurrent": false,
            "startDate": "",
            "occupation": "",
            "employerAbn": "",
            "employerAcn": "",
            "onProbation": false,
            "employerName": "Roc Partners",
            "employerType": "",
            "employmentType": "PAYG",
            "employerAddress": "",
            "employmentBasis": "Full time",
            "contactPersonName": "",
            "employmentPriority": "Primary",
            "contactPersonDetails": ""
          }
        ],
        "middleName": "John",
        "phoneMobile": "0400000002",
        "previousName": "",
        "emailPersonal": "one@example.com",
        "preferredName": ""
      }
    ],
    "dependants": "2",
    "properties": [
      {
        "id": "ffeaa872-1837-43ec-980d-6c587bfe73d2",
        "loans": [
          {
            "id": "65ffd7bd-7714-440d-89f7-12b9f1a9573f",
            "bsb": "000000",
            "status": "Ongoing",
            "balance": "1279283.98",
            "rateType": "Variable",
            "ownership": {
              "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "50",
              "a53e77d9-5260-46d0-91ab-01fd52066c10": "50"
            },
            "lenderName": "Macquarie",
            "limitAmount": "1279283.98",
            "interestRate": "6.04",
            "mortgageType": "Owner occupied",
            "accountNumber": "-0000",
            "repaymentType": "Principal and interest",
            "repaymentAmount": "8220",
            "loanTermExpiryDate": "",
            "repaymentFrequency": "Monthly",
            "interestOnlyExpiryDate": "",
            "remainingLoanTermYears": "30"
          }
        ],
        "value": "3000000",
        "zoning": "Residential",
        "address": "14 Sample Street, Suburbia NSW 2000",
        "futureUse": "To be sold",
        "ownership": {
          "771e8c5d-f7e5-48e2-b863-d3ad715d9471": "100",
          "a53e77d9-5260-46d0-91ab-01fd52066c10": "0"
        },
        "rentalIncome": "",
        "runningCosts": "",
        "ownershipType": "Owner occupied",
        "bodyCorpAmount": "",
        "propertySubtype": "Fully detached house",
        "valuationMethod": "Applicant estimate",
        "bodyCorpFrequency": "Monthly",
        "rpDataEstimatedValue": "",
        "rentalIncomeFrequency": "Weekly",
        "runningCostsFrequency": "Monthly"
      }
    ],
    "liabilities": []
  }
}

const chapman = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })

const lender = (over: any = {}) => ({
  lenderName: 'ING', productName: 'Orange Advantage', offsetAccount: 'Yes', annualFee: '$299/yr',
  variablePI: { enabled: true, rate: '5.99' }, variableIO: { enabled: false },
  fixedPI: { enabled: false }, fixedIO: { enabled: false }, ...over,
})

describe('the variation is the deal’s, never the moment’s', () => {
  it('is the same every time for one deal', () => {
    const runs = new Set(Array.from({ length: 50 }, () => boxOne(chapman()).text))
    expect(runs.size).toBe(1)
  })

  it('differs across deals', () => {
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => variantOf(id)))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('is always one of the three, even with no id', () => {
    expect([1, 2, 3]).toContain(variantOf(undefined))
    expect([1, 2, 3]).toContain(variantOf(''))
  })
})

describe('the product decides, not the questionnaire', () => {
  it('mentions redraw on a variable loan', () => {
    for (const v of [1, 2, 3] as const)
      expect(flexibilityPassage(structureOf(chapman()), 'they', v)).toMatch(/redraw|draw it back|drawn back/i)
  })

  it('never mentions redraw on a fixed-only loan', () => {
    const d = chapman()
    d.lo_data.lenders = [lender({ variablePI: { enabled: false }, fixedPI: { enabled: true, fixedYears: '3' } })]
    for (const v of [1, 2, 3] as const)
      expect(flexibilityPassage(structureOf(d), 'they', v)).not.toMatch(/redraw/i)
  })

  it('mentions the offset when the product has one, whatever the client ticked', () => {
    const d = chapman()
    d.compliance_data.productReqs.offsetAccount = 'Do not want'
    // Variant 1 says "the offset sits alongside", 2 and 3 say "offset account" -
    // all three mention it, which is the point.
    expect(boxOne(d).text).toMatch(/offset/i)
  })

  it('never mentions an offset the product does not have', () => {
    const d = chapman()
    d.lo_data.lenders = [lender({ offsetAccount: 'No' })]
    d.compliance_data.productReqs.offsetAccount = 'Important'
    const t = boxOne(d).text
    // Three wordings, three ways of saying it is absent.
    expect(t).toMatch(/does not include an offset|no offset account|without an offset account/i)
    expect(t).not.toMatch(/The offset account works|offset sits alongside/i)
  })

  it('never mentions fixed on an all-variable loan, however important they said it was', () => {
    const d = chapman()
    d.compliance_data.productReqs.fixedAndVariable = 'Important'
    d.compliance_data.productReqs.fixedRate = 'Important'
    expect(boxOne(d).text).not.toMatch(/\bfixed\b/i)
  })
})

describe('no offset — the fee claim has to trace to a field', () => {
  const noOffset = (annualFee: string) => {
    const d = chapman()
    d.lo_data.lenders = [lender({ offsetAccount: 'No', annualFee })]
    return boxOne(d).text
  }

  it('claims no ongoing fee only when the product records a nil fee', () => {
    expect(noOffset('$0')).toMatch(/no ongoing annual fee/i)
    expect(noOffset('nil')).toMatch(/no ongoing annual fee/i)
  })

  it('says nothing about fees when a fee is charged', () => {
    expect(noOffset('$395/yr')).not.toMatch(/no ongoing annual fee/i)
  })

  it('says nothing about fees when no fee has been recorded at all', () => {
    expect(noOffset('')).not.toMatch(/no ongoing annual fee/i)
  })

  it('still leans on redraw', () => {
    expect(noOffset('$0')).toMatch(/redraw/i)
  })
})

describe('first home buyer — only on the first home buyer scenario', () => {
  it('is silent on an OO purchase, even though they own a property', () => {
    expect(boxOne(chapman()).text).not.toMatch(/first home buyer/i)
  })

  it('is silent when no property is recorded — owning nothing proves nothing', () => {
    const d = chapman()
    d.fact_find_data.properties = []
    expect(boxOne(d).text).not.toMatch(/first home buyer/i)
  })

  it('says it on the fhb scenario', () => {
    const d = chapman()
    d.bc_data.template = 'fhb'
    expect(boxOne(d).text).toMatch(/first home buyers/i)
  })
})

describe('gaps are shouted, not smoothed over', () => {
  it('shouts a missing purpose and lists it', () => {
    const r = boxOne(chapman())
    expect(r.text).toMatch(/\*\* NOT RECORDED — .*(reason|purpose|want the loan for)/i)
    expect(r.gaps.map(g => g.what)).toContain("The clients' own reason for the loan")
  })

  it('quotes the clients’ own words when they are there, and stops shouting', () => {
    const d = chapman()
    d.fact_find_data.loanPurpose = 'We want to upgrade the family home.'
    const r = boxOne(d)
    expect(r.text).toContain('"We want to upgrade the family home."')
    expect(r.gaps.map(g => g.what)).not.toContain("The clients' own reason for the loan")
  })

  it('shouts that the sale proceeds are unrecorded', () => {
    const r = boxOne(chapman())
    expect(r.text).toMatch(/\*\* NOT RECORDED — .*(net|sale)/i)
    expect(r.gaps.map(g => g.what)).toContain('Expected net proceeds of the sale')
  })

  it('shouts when only one lender is on the file', () => {
    const d = chapman()
    d.lo_data.lenders = [lender()]
    const r = boxOne(d)
    expect(r.text).toMatch(/\*\* ONLY ONE LENDER RECORDED/)
    expect(r.gaps.map(g => g.what)).toContain('Only one lender option recorded')
  })

  it('the shout survives being copied as plain text', () => {
    // No colour, no markup - the marker is the words themselves.
    expect(boxOne(chapman()).text).toContain('** NOT RECORDED')
  })
})

describe('the closing line', () => {
  it('names the recommendation and everyone it was weighed against', () => {
    for (const v of [1, 2, 3] as const) {
      const t = lendersLine(chapman(), v).text
      expect(t).toContain('ING')
      expect(t).toContain('CBA')
    }
  })

  it('reads naturally with three lenders', () => {
    const d = chapman()
    d.lo_data.lenders.push(lender({ lenderName: 'NAB', productName: 'Choice' }))
    expect(lendersLine(d, 1).text).toContain('CBA and NAB')
  })

  it('keeps the broker’s reason as its own sentence, never spliced with a comma', () => {
    const t = lendersLine(chapman(), 2).text
    expect(t).not.toMatch(/,\s+They offer/)
    expect(t).toContain('. They offer')
  })

  it('shouts when no lender has been marked as recommended', () => {
    const d = chapman()
    d.lo_data.recommendedLender = ''
    d.lo_data.lenders = []
    expect(lendersLine(d, 1).text).toMatch(/\*\* NO RECOMMENDED LENDER RECORDED/)
  })
})

describe('it reads like a person wrote it', () => {
  const t = () => boxOne(chapman()).text

  it('writes small counts and the term as words', () => {
    expect(t()).toContain('two dependants')
    expect(t()).toContain('thirty year term')
  })

  it('gives an occupation its article', () => {
    expect(t()).toContain('as an investment manager')
  })

  it('leads with the applicant who earns', () => {
    expect(t()).toMatch(/Daniel is employed[^.]*; Rachel is not working/)
  })

  it('never leaves a raw database key in the prose', () => {
    expect(t()).not.toMatch(/oo_purchase|lo_purchase|investment_equity|refinance_only/)
  })

  it('never prints an empty dollar sign or a bare placeholder', () => {
    expect(t()).not.toMatch(/\$\s|\$XXX|\[calculated\]|undefined|NaN|\$,/)
  })
})

describe('the money is read, never guessed', () => {
  it('names the property being sold, which nothing used to pass on', () => {
    expect(boxOne(chapman()).text).toContain('recorded as being sold')
  })

  it('states the savings left over when the cash actually covers it', () => {
    const d = chapman()
    d.fact_find_data.properties = []
    d.fact_find_data.assets = [{ assetType: 'Bank account', value: '4,500,000' }]
    expect(boxOne(d).text).toMatch(/leaving \$658,500 of recorded savings held after settlement/)
  })

  it('reads comma-formatted money rather than turning it into NaN', () => {
    expect(boxOne(chapman()).text).toContain('$1,700,000')
  })
})

describe('andList', () => {
  it('joins the way a person speaks', () => {
    expect(andList(['A'])).toBe('A')
    expect(andList(['A', 'B'])).toBe('A and B')
    expect(andList(['A', 'B', 'C'])).toBe('A, B and C')
    expect(andList(['A', '', 'C'])).toBe('A and C')
    expect(andList([])).toBe('')
  })
})

describe('punctuation, because it is read by people', () => {
  const withPurpose = (p: string) => {
    const d = chapman(); d.fact_find_data.loanPurpose = p; return boxOne(d).text
  }
  it('does not double up a full stop the client already wrote', () => {
    expect(withPurpose('We want to upgrade the family home.')).toContain('home."')
    expect(withPurpose('We want to upgrade the family home.')).not.toContain('.".')
  })
  it('adds one when they did not', () => {
    expect(withPurpose('Upgrade the family home')).toContain('home."')
  })
  it('never leaves a double space or a stranded comma', () => {
    const t = boxOne(chapman()).text
    expect(t).not.toMatch(/ {2}| ,|,,|\.\./)
  })
})
