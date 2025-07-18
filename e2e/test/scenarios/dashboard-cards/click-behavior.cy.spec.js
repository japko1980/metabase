const { H } = cy;
import { SAMPLE_DB_ID, USER_GROUPS } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import {
  NORMAL_USER_ID,
  ORDERS_BY_YEAR_QUESTION_ID,
  ORDERS_DASHBOARD_ID,
  ORDERS_QUESTION_ID,
} from "e2e/support/cypress_sample_instance_data";
import {
  createMockActionParameter,
  createMockDashboardCard,
} from "metabase-types/api/mocks";

const COUNT_COLUMN_ID = "count";
const COUNT_COLUMN_NAME = "Count";
const COUNT_COLUMN_SOURCE = {
  type: "column",
  id: COUNT_COLUMN_ID,
  name: COUNT_COLUMN_NAME,
};
const CREATED_AT_COLUMN_ID = "CREATED_AT";
const CREATED_AT_COLUMN_NAME = "Created At: Month";
const CREATED_AT_COLUMN_SOURCE = {
  type: "column",
  id: CREATED_AT_COLUMN_ID,
  name: CREATED_AT_COLUMN_NAME,
};
const FILTER_VALUE = "123";
const POINT_COUNT = 64;
const POINT_CREATED_AT = "2022-07";
const POINT_CREATED_AT_FORMATTED = "July 2022";
const POINT_INDEX = 3;
const RESTRICTED_COLLECTION_NAME = "Restricted collection";
const COLUMN_INDEX = {
  CREATED_AT: 0,
  COUNT: 1,
};

// these ids aren't real, but you have to provide unique ids 🙄
const FIRST_TAB = { id: 900, name: "first" };
const SECOND_TAB = { id: 901, name: "second" };
const THIRD_TAB = { id: 902, name: "third" };

const { ORDERS, ORDERS_ID, PEOPLE, PRODUCTS, REVIEWS, REVIEWS_ID } =
  SAMPLE_DATABASE;

const TARGET_DASHBOARD = {
  name: "Target dashboard",
};

const QUESTION_LINE_CHART = {
  name: "Line chart",
  display: "line",
  query: {
    aggregation: [["count"]],
    breakout: [
      [
        "field",
        ORDERS.CREATED_AT,
        { "base-type": "type/DateTime", "temporal-unit": "month" },
      ],
    ],
    "source-table": ORDERS_ID,
    limit: 5,
  },
};

const QUESTION_TABLE = {
  name: "Table",
  display: "table",
  query: QUESTION_LINE_CHART.query,
};

const OBJECT_DETAIL_CHART = {
  display: "object",
  query: {
    "source-table": ORDERS_ID,
  },
};

const TARGET_QUESTION = {
  ...QUESTION_LINE_CHART,
  name: "Target question",
};

const DASHBOARD_FILTER_TEXT = createMockActionParameter({
  id: "1",
  name: "Text filter",
  slug: "filter-text",
  type: "string/=",
  sectionId: "string",
});

const DASHBOARD_FILTER_TIME = createMockActionParameter({
  id: "2",
  name: "Time filter",
  slug: "filter-time",
  type: "date/month-year",
  sectionId: "date",
});

const DASHBOARD_FILTER_NUMBER = createMockActionParameter({
  id: "3",
  name: "Number filter",
  slug: "filter-number",
  type: "number/>=",
  sectionId: "number",
});

const DASHBOARD_FILTER_TEXT_WITH_DEFAULT = createMockActionParameter({
  id: "4",
  name: "Text filter with default",
  slug: "filter-with-default",
  type: "string/=",
  sectionId: "string",
  default: "Hello",
});

const URL = "https://metabase.com/";
const URL_WITH_PARAMS = `${URL}{{${DASHBOARD_FILTER_TEXT.slug}}}/{{${COUNT_COLUMN_ID}}}/{{${CREATED_AT_COLUMN_ID}}}`;
const URL_WITH_FILLED_PARAMS = URL_WITH_PARAMS.replace(
  `{{${COUNT_COLUMN_ID}}}`,
  POINT_COUNT,
)
  .replace(`{{${CREATED_AT_COLUMN_ID}}}`, POINT_CREATED_AT)
  .replace(`{{${DASHBOARD_FILTER_TEXT.slug}}}`, FILTER_VALUE);

describe("scenarios > dashboard > dashboard cards > click behavior", () => {
  beforeEach(() => {
    H.restore();
    cy.signInAsAdmin();
    cy.intercept("/api/dataset").as("dataset");
    H.activateToken("pro-self-hosted");
  });

  describe("dashcards without click behavior", () => {
    it("does not allow to set click behavior for virtual dashcards", () => {
      const textCard = H.getTextCardDetails({ size_y: 1 });
      const headingCard = H.getHeadingCardDetails({ text: "Heading card" });
      const actionCard = H.getActionCardDetails();
      const linkCard = H.getLinkCardDetails();
      const cards = [textCard, headingCard, actionCard, linkCard];

      H.createDashboard().then(({ body: dashboard }) => {
        H.updateDashboardCards({ dashboard_id: dashboard.id, cards });
        H.visitDashboard(dashboard.id);
      });

      H.editDashboard();

      cards.forEach((card, index) => {
        const display = card.visualization_settings.virtual_card.display;
        cy.log(`does not allow to set click behavior for "${display}" card`);

        H.getDashboardCard(index).realHover().icon("click").should("not.exist");
      });
    });

    it("does not allow to set click behavior for object detail dashcard", () => {
      H.createQuestionAndDashboard({
        questionDetails: OBJECT_DETAIL_CHART,
      }).then(({ body: card }) => {
        H.visitDashboard(card.dashboard_id);
      });

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").should("not.exist");
    });
  });

  describe("line chart", () => {
    const questionDetails = QUESTION_LINE_CHART;

    it("should open drill-through menu as a default click-behavior", () => {
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      clickLineChartPoint();
      assertDrillThroughMenuOpen();
    });

    it("should open drill-through menu for native query based dashcard", () => {
      H.createNativeQuestionAndDashboard({
        questionDetails: {
          name: "Native Question",
          display: "line",
          native: {
            query: `
              SELECT
                DATE_TRUNC('month', CREATED_AT) AS "Created At",
                COUNT(*) AS "count"
              FROM
                ORDERS
              GROUP BY
                DATE_TRUNC('month', CREATED_AT)
              LIMIT
                5
            `,
          },
        },
        dashboardDetails: {
          name: "Dashboard",
        },
      }).then(({ body: card }) => {
        H.visitDashboard(card.dashboard_id);
      });

      clickLineChartPoint();
      // TODO: fix it, currently we drill down to the question on dot click
      // assertDrillThroughMenuOpen();
    });

    it("allows setting dashboard without filters as custom destination and changing it back to default click behavior", () => {
      H.createDashboard(TARGET_DASHBOARD, {
        wrapId: true,
        idAlias: "targetDashboardId",
      });
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      cy.log("doesn't throw when setting default behavior (metabase#35354)");
      cy.on("uncaught:exception", (err) => {
        expect(err.name.includes("TypeError")).to.be.false;
      });

      H.getDashboardCard().realHover().icon("click").click();

      // When the default menu is selected, it should've visual cue (metabase#34848)
      cy.get("aside")
        .findByText("Open the Metabase drill-through menu")
        .parent()
        .parent()
        .should("have.attr", "aria-selected", "true")
        .should("have.css", "background-color", "rgb(80, 158, 227)");

      addDashboardDestination();
      cy.get("aside").findByText("Select a dashboard tab").should("not.exist");
      cy.get("aside").findByText("No available targets").should("exist");
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      cy.intercept(
        "GET",
        "/api/collection/root",
        cy.spy().as("rootCollection"),
      );
      cy.intercept("GET", "/api/collection", cy.spy().as("collections"));

      clickLineChartPoint();
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal("");
        });
      });

      cy.log("Should navigate to question using router (metabase#33379)");
      H.dashboardHeader()
        .findByText(TARGET_DASHBOARD.name)
        .should("be.visible");
      // If the page was reloaded, many API request would have been made and theses
      // calls are 2 of those.
      cy.get("@rootCollection").should("not.have.been.called");
      cy.get("@collections").should("not.have.been.called");
    });

    it("allows setting dashboard with single parameter as custom destination", () => {
      H.createDashboard(
        {
          ...TARGET_DASHBOARD,
          parameters: [DASHBOARD_FILTER_TEXT],
        },
        {
          wrapId: true,
          idAlias: "targetDashboardId",
        },
      ).then((dashboardId) => {
        cy.request("PUT", `/api/dashboard/${dashboardId}`, {
          dashcards: [
            createMockDashboardCard({
              card_id: ORDERS_QUESTION_ID,
              parameter_mappings: [
                createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
              ],
            }),
          ],
        });
      });

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addDashboardDestination();
      cy.get("aside").findByText("Select a dashboard tab").should("not.exist");
      cy.get("aside").findByText("No available targets").should("not.exist");
      addTextParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 1)
        .should("contain.text", POINT_COUNT);
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}`,
          );
        });
      });
    });

    it("allows setting dashboard with multiple parameters as custom destination", () => {
      H.createDashboard(
        {
          ...TARGET_DASHBOARD,
          parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
        },
        {
          wrapId: true,
          idAlias: "targetDashboardId",
        },
      ).then((dashboardId) => {
        cy.request("PUT", `/api/dashboard/${dashboardId}`, {
          dashcards: [
            createMockDashboardCard({
              card_id: ORDERS_QUESTION_ID,
              parameter_mappings: [
                createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
                createTimeFilterMapping({ card_id: ORDERS_QUESTION_ID }),
              ],
            }),
          ],
        });
      });

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addDashboardDestination();
      cy.get("aside").findByText("Select a dashboard tab").should("not.exist");
      cy.get("aside").findByText("No available targets").should("not.exist");
      addTextParameter();
      addTimeParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 2)
        .should("contain.text", POINT_COUNT)
        .should("contain.text", POINT_CREATED_AT_FORMATTED);
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}&${DASHBOARD_FILTER_TIME.slug}=${POINT_CREATED_AT}`,
          );
        });
      });
    });

    it("allows setting dashboard tab with parameter as custom destination", () => {
      const dashboard = {
        ...TARGET_DASHBOARD,
        parameters: [DASHBOARD_FILTER_TEXT],
      };

      const tabs = [FIRST_TAB, SECOND_TAB, THIRD_TAB];

      const options = {
        wrapId: true,
        idAlias: "targetDashboardId",
      };

      createDashboardWithTabsLocal({
        dashboard,
        tabs,
        dashcards: [
          createMockDashboardCard({
            dashboard_tab_id: SECOND_TAB.id,
            card_id: ORDERS_QUESTION_ID,
            parameter_mappings: [
              createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
            ],
          }),
        ],
        options,
      });

      const TAB_SLUG_MAP = {};

      tabs.forEach((tab) => {
        cy.get(`@${tab.name}-id`).then((tabId) => {
          TAB_SLUG_MAP[tab.name] = `${tabId}-${tab.name}`;
        });
      });

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
          cy.wrap(card.dashboard_id).as("dashboardId");
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addDashboardDestination();
      cy.get("aside")
        .findByLabelText("Select a dashboard tab")
        .should("have.value", FIRST_TAB.name)
        .click();
      cy.findByRole("listbox").findByText(SECOND_TAB.name).click();
      cy.get("aside").findByText("No available targets").should("not.exist");
      addTextParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 1)
        .should("contain.text", POINT_COUNT);
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          const tabParam = `tab=${TAB_SLUG_MAP[SECOND_TAB.name]}`;
          const textFilterParam = `${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}`;
          expect(search).to.equal(`?${textFilterParam}&${tabParam}`);
        });
      });
    });

    it("should show error and disable the form after target dashboard tab has been removed and there is more than 1 tab left", () => {
      const options = {
        wrapId: true,
        idAlias: "targetDashboardId",
      };
      const tabs = [FIRST_TAB, SECOND_TAB, THIRD_TAB];

      createDashboardWithTabsLocal({
        dashboard: TARGET_DASHBOARD,
        tabs,
        options,
      });

      const TAB_SLUG_MAP = {};
      tabs.forEach((tab) => {
        cy.get(`@${tab.name}-id`).then((tabId) => {
          TAB_SLUG_MAP[tab.name] = `${tabId}-${tab.name}`;
        });
      });

      cy.get("@targetDashboardId").then((targetDashboardId) => {
        const inexistingTabId = 999;
        const cardDetails = {
          visualization_settings: {
            click_behavior: {
              parameterMapping: {},
              targetId: targetDashboardId,
              tabId: inexistingTabId,
              linkType: "dashboard",
              type: "link",
            },
          },
        };
        H.createQuestionAndDashboard({
          questionDetails,
          cardDetails,
        }).then(({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        });
      });

      H.editDashboard();
      H.getDashboardCard().realHover().icon("click").click();

      cy.get("aside")
        .findByText("The selected tab is no longer available")
        .should("exist");
      cy.button("Done").should("be.disabled");

      cy.get("aside")
        .findByLabelText("Select a dashboard tab")
        .should("not.have.value")
        .click();
      cy.findByRole("listbox").findByText(SECOND_TAB.name).click();

      cy.get("aside")
        .findByText("The selected tab is no longer available")
        .should("not.exist");
      cy.button("Done").should("be.enabled").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal(`?tab=${TAB_SLUG_MAP[SECOND_TAB.name]}`);
        });
      });
    });

    it("should fall back to the first tab after target dashboard tab has been removed and there is only 1 tab left", () => {
      H.createDashboard(TARGET_DASHBOARD, {
        wrapId: true,
        idAlias: "targetDashboardId",
      });
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        const inexistingTabId = 999;
        const cardDetails = {
          visualization_settings: {
            click_behavior: {
              parameterMapping: {},
              targetId: targetDashboardId,
              tabId: inexistingTabId,
              linkType: "dashboard",
              type: "link",
            },
          },
        };
        H.createQuestionAndDashboard({
          questionDetails,
          cardDetails,
        }).then(({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        });
      });

      H.editDashboard();
      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside")
        .findByLabelText("Select a dashboard tab")
        .should("not.exist");
      cy.button("Done").should("be.enabled").click();
      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal("");
        });
      });
    });

    it("dashboard click behavior works without tabId previously saved", () => {
      const tabs = [FIRST_TAB, SECOND_TAB, THIRD_TAB];

      const options = {
        wrapId: true,
        idAlias: "targetDashboardId",
      };

      createDashboardWithTabsLocal({
        dashboard: TARGET_DASHBOARD,
        tabs,
        options,
      });

      const TAB_SLUG_MAP = {};
      tabs.forEach((tab) => {
        cy.get(`@${tab.name}-id`).then((tabId) => {
          TAB_SLUG_MAP[tab.name] = `${tabId}-${tab.name}`;
        });
      });

      cy.get("@targetDashboardId").then((targetDashboardId) => {
        const cardDetails = {
          visualization_settings: {
            click_behavior: {
              parameterMapping: {},
              targetId: targetDashboardId,
              tabId: undefined,
              linkType: "dashboard",
              type: "link",
            },
          },
        };
        H.createQuestionAndDashboard({
          questionDetails,
          cardDetails,
        }).then(({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
          cy.wrap(card.dashboard_id).as("dashboardId");
        });
      });

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside")
        .findByLabelText("Select a dashboard tab")
        .should("have.value", FIRST_TAB.name);

      cy.get("header").button("Cancel").click();
      // migrateUndefinedDashboardTabId causes detection of changes even though user did not change anything
      H.modal().button("Discard changes").click();
      cy.button("Cancel").should("not.exist");
      cy.findByTestId("visualization-root")
        .findByText("May 2022")
        .should("exist");
      clickLineChartPoint();
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal(`?tab=${TAB_SLUG_MAP[FIRST_TAB.name]}`);
        });
      });
    });

    it("sets non-specified parameters to default values when accessed from a click action", () => {
      H.createDashboard(
        {
          ...TARGET_DASHBOARD,
          parameters: [
            DASHBOARD_FILTER_TEXT,
            DASHBOARD_FILTER_TEXT_WITH_DEFAULT,
          ],
        },
        {
          wrapId: true,
          idAlias: "targetDashboardId",
        },
      )
        .then((dashboardId) => {
          return cy
            .request("PUT", `/api/dashboard/${dashboardId}`, {
              dashcards: [
                createMockDashboardCard({
                  card_id: ORDERS_QUESTION_ID,
                  parameter_mappings: [
                    createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
                    createTextFilterWithDefaultMapping({
                      card_id: ORDERS_QUESTION_ID,
                    }),
                  ],
                }),
              ],
            })
            .then(() => dashboardId);
        })
        .then((dashboardId) => {
          H.visitDashboard(dashboardId);
        });

      H.filterWidget().contains("Hello").click();
      H.dashboardParametersPopover().within(() => {
        H.fieldValuesCombobox().type("{backspace}World{enter}{esc}");
        cy.button("Update filter").click();
      });

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addDashboardDestination();
      cy.get("aside").findByText("Select a dashboard tab").should("not.exist");
      cy.get("aside").findByText("No available targets").should("not.exist");
      addTextParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();

      cy.findAllByTestId("parameter-widget")
        .contains(DASHBOARD_FILTER_TEXT.name)
        .parent()
        .should("contain.text", POINT_COUNT);
      cy.findAllByTestId("parameter-widget")
        .contains(DASHBOARD_FILTER_TEXT_WITH_DEFAULT.name)
        .parent()
        .should("contain.text", DASHBOARD_FILTER_TEXT_WITH_DEFAULT.default);

      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}&${DASHBOARD_FILTER_TEXT_WITH_DEFAULT.slug}=Hello`,
          );
        });
      });
    });

    it("sets parameters with default values to the correct value when accessed via click action", () => {
      H.createDashboard(
        {
          ...TARGET_DASHBOARD,
          parameters: [
            DASHBOARD_FILTER_TEXT,
            DASHBOARD_FILTER_TEXT_WITH_DEFAULT,
          ],
        },
        {
          wrapId: true,
          idAlias: "targetDashboardId",
        },
      )
        .then((dashboardId) => {
          return cy
            .request("PUT", `/api/dashboard/${dashboardId}`, {
              dashcards: [
                createMockDashboardCard({
                  card_id: ORDERS_QUESTION_ID,
                  parameter_mappings: [
                    createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
                    createTextFilterWithDefaultMapping({
                      card_id: ORDERS_QUESTION_ID,
                    }),
                  ],
                }),
              ],
            })
            .then(() => dashboardId);
        })
        .then((dashboardId) => {
          H.visitDashboard(dashboardId);
        });

      cy.findAllByTestId("parameter-widget")
        .contains(DASHBOARD_FILTER_TEXT.name)
        .parent()
        .click();
      H.dashboardParametersPopover().within(() => {
        H.fieldValuesCombobox().type("John Doe{enter}{esc}");
        cy.button("Add filter").click();
      });

      cy.findAllByTestId("parameter-widget")
        .contains(DASHBOARD_FILTER_TEXT_WITH_DEFAULT.name)
        .parent()
        .click();
      H.dashboardParametersPopover().within(() => {
        H.fieldValuesCombobox().type("{backspace}World{enter}{esc}");
        cy.button("Update filter").click();
      });

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addDashboardDestination();
      cy.get("aside").findByText("Select a dashboard tab").should("not.exist");
      cy.get("aside").findByText("No available targets").should("not.exist");
      addTextWithDefaultParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .contains(DASHBOARD_FILTER_TEXT_WITH_DEFAULT.name)
        .parent()
        .should("contain.text", POINT_COUNT);

      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_TEXT.slug}=&${DASHBOARD_FILTER_TEXT_WITH_DEFAULT.slug}=${POINT_COUNT}`,
          );
        });
      });
    });

    it("does not allow setting dashboard as custom destination if user has no permissions to it", () => {
      H.createCollection({ name: RESTRICTED_COLLECTION_NAME }).then(
        ({ body: restrictedCollection }) => {
          cy.updateCollectionGraph({
            [USER_GROUPS.COLLECTION_GROUP]: {
              [restrictedCollection.id]: "none",
            },
          });

          H.createDashboard({
            ...TARGET_DASHBOARD,
            collection_id: restrictedCollection.id,
          });
        },
      );

      cy.signOut();
      cy.signInAsNormalUser();

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside").findByText("Go to a custom destination").click();
      cy.get("aside").findByText("Dashboard").click();

      H.modal().findByText(RESTRICTED_COLLECTION_NAME).should("not.exist");
    });

    it("allows setting saved question as custom destination and changing it back to default click behavior", () => {
      H.createQuestion(TARGET_QUESTION, { wrapId: true });
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addSavedQuestionDestination();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      cy.intercept(
        "GET",
        "/api/collection/root",
        cy.spy().as("rootCollection"),
      );
      cy.intercept("GET", "/api/collection", cy.spy().as("collections"));

      clickLineChartPoint();
      cy.get("@questionId").then((questionId) => {
        cy.location()
          .its("pathname")
          .should("contain", `/question/${questionId}`);
      });
      H.queryBuilderHeader()
        .findByDisplayValue(TARGET_QUESTION.name)
        .should("be.visible");

      cy.log("Should navigate to question using router (metabase#33379)");
      cy.findByTestId("view-footer").should("contain", "Showing 5 rows");
      // If the page was reloaded, many API request would have been made and theses
      // calls are 2 of those.
      cy.get("@rootCollection").should("not.have.been.called");
      cy.get("@collections").should("not.have.been.called");

      cy.go("back");
      testChangingBackToDefaultBehavior();
    });

    it("allows setting saved question with single parameter as custom destination", () => {
      H.createQuestion(TARGET_QUESTION);
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addSavedQuestionDestination();
      addSavedQuestionCreatedAtParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findByTestId("qb-filters-panel").should(
        "have.text",
        "Created At is Jul 1–31, 2022",
      );

      cy.location("pathname").should("equal", "/question");
      cy.findByTestId("app-bar").should(
        "contain.text",
        `Started from ${TARGET_QUESTION.name}`,
      );
      verifyVizTypeIsLine();

      H.openNotebook();
      H.verifyNotebookQuery("Orders", [
        {
          filters: ["Created At is Jul 1–31, 2022"],
          aggregations: ["Count"],
          breakouts: ["Created At: Month"],
          limit: 5,
        },
      ]);

      cy.go("back");
      cy.log("return to the dashboard");
      cy.go("back");
      testChangingBackToDefaultBehavior();
    });

    it("allows setting saved question with multiple parameters as custom destination", () => {
      H.createQuestion(TARGET_QUESTION);
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addSavedQuestionDestination();
      addSavedQuestionCreatedAtParameter();
      addSavedQuestionQuantityParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.wait("@dataset");
      cy.findByTestId("qb-filters-panel")
        .should("contain.text", "Created At is Jul 1–31, 2022")
        .should("contain.text", "Quantity is equal to 64");

      cy.location("pathname").should("equal", "/question");
      cy.findByTestId("app-bar").should(
        "contain.text",
        `Started from ${TARGET_QUESTION.name}`,
      );
      verifyVizTypeIsLine();

      H.openNotebook();
      H.verifyNotebookQuery("Orders", [
        {
          filters: ["Created At is Jul 1–31, 2022", "Quantity is equal to 64"],
          aggregations: ["Count"],
          breakouts: ["Created At: Month"],
          limit: 5,
        },
      ]);
    });

    it("does not allow setting saved question as custom destination if user has no permissions to it", () => {
      H.createCollection({ name: RESTRICTED_COLLECTION_NAME }).then(
        ({ body: restrictedCollection }) => {
          cy.updateCollectionGraph({
            [USER_GROUPS.COLLECTION_GROUP]: {
              [restrictedCollection.id]: "none",
            },
          });

          H.createQuestion({
            ...TARGET_QUESTION,
            collection_id: restrictedCollection.id,
          });
        },
      );

      cy.signOut();
      cy.signInAsNormalUser();

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside").findByText("Go to a custom destination").click();
      cy.get("aside").findByText("Saved question").click();

      H.modal().findByText(RESTRICTED_COLLECTION_NAME).should("not.exist");
    });

    it("allows setting URL as custom destination and changing it back to default click behavior", () => {
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addUrlDestination();
      H.modal().within(() => {
        cy.findByRole("textbox").type(URL);
        cy.button("Done").click();
      });
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      onNextAnchorClick((anchor) => {
        expect(anchor).to.have.attr("href", URL);
        expect(anchor).to.have.attr("rel", "noopener");
        expect(anchor).to.have.attr("target", "_blank");
      });
      clickLineChartPoint();

      testChangingBackToDefaultBehavior();
    });

    it("allows setting URL with parameters as custom destination", () => {
      const dashboardDetails = {
        parameters: [DASHBOARD_FILTER_TEXT],
      };

      H.createQuestionAndDashboard({ questionDetails, dashboardDetails }).then(
        ({ body: dashcard }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: dashcard.dashboard_id,
            card_id: dashcard.card_id,
            card: {
              parameter_mappings: [
                createTextFilterMapping({ card_id: dashcard.card_id }),
              ],
            },
          });
          H.visitDashboard(dashcard.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addUrlDestination();
      H.modal().findByText("Values you can reference").click();
      H.popover().within(() => {
        cy.findByText(COUNT_COLUMN_ID).should("exist");
        cy.findByText(CREATED_AT_COLUMN_ID).should("exist");
        cy.findByText(DASHBOARD_FILTER_TEXT.name).should("exist");
        cy.realPress("Escape");
      });
      H.modal().within(() => {
        cy.findByRole("textbox").type(URL_WITH_PARAMS, {
          parseSpecialCharSequences: false,
        });
        cy.button("Done").click();
      });
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      cy.button(DASHBOARD_FILTER_TEXT.name).click();
      H.dashboardParametersPopover().within(() => {
        cy.findByPlaceholderText("Search the list").type("Dell Adams");
        cy.button("Add filter").click();
      });

      onNextAnchorClick((anchor) => {
        expect(anchor).to.have.attr("href", URL_WITH_FILLED_PARAMS);
        expect(anchor).to.have.attr("rel", "noopener");
        expect(anchor).to.have.attr("target", "_blank");
      });
      clickLineChartPoint();
    });

    it("does not allow updating dashboard filters if there are none", () => {
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside")
        .findByText("Update a dashboard filter")
        .invoke("css", "pointer-events")
        .should("equal", "none");
    });

    it("allows updating single dashboard filter and changing it back to default click behavior", () => {
      const dashboardDetails = {
        parameters: [DASHBOARD_FILTER_NUMBER],
      };

      H.createQuestionAndDashboard({ questionDetails, dashboardDetails }).then(
        ({ body: dashcard }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: dashcard.dashboard_id,
            card_id: dashcard.card_id,
            card: {
              parameter_mappings: [
                createNumberFilterMapping({ card_id: dashcard.card_id }),
              ],
            },
          });
          H.visitDashboard(dashcard.dashboard_id);
          cy.location().then(({ pathname }) => {
            cy.wrap(pathname).as("originalPathname");
          });
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside").findByText("Update a dashboard filter").click();
      addNumericParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 1)
        .should("contain.text", POINT_COUNT);
      cy.get("@originalPathname").then((originalPathname) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(originalPathname);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_NUMBER.slug}=${POINT_COUNT}`,
          );
        });
      });

      cy.log("reset filter state");

      H.filterWidget().icon("close").click();

      testChangingBackToDefaultBehavior();
    });

    it("behavior is updated after linked dashboard filter has been removed", () => {
      const dashboardDetails = {
        parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
      };

      H.createQuestionAndDashboard({ questionDetails, dashboardDetails }).then(
        ({ body: dashcard }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: dashcard.dashboard_id,
            card_id: dashcard.card_id,
            card: {
              parameter_mappings: [
                createTextFilterMapping({ card_id: dashcard.card_id }),
                createTimeFilterMapping({ card_id: dashcard.card_id }),
              ],
            },
          });
          H.visitDashboard(dashcard.dashboard_id);
          cy.location().then(({ pathname }) => {
            cy.wrap(pathname).as("originalPathname");
          });
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside").findByText("Update a dashboard filter").click();
      addTextParameter();
      addTimeParameter();
      cy.get("aside")
        .should("contain.text", DASHBOARD_FILTER_TEXT.name)
        .should("contain.text", COUNT_COLUMN_NAME);
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      H.editDashboard();
      cy.findByTestId("edit-dashboard-parameters-widget-container")
        .findByText(DASHBOARD_FILTER_TEXT.name)
        .click();
      cy.get("aside").button("Remove").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 1)
        .should("contain.text", POINT_CREATED_AT_FORMATTED);
      cy.get("@originalPathname").then((originalPathname) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(originalPathname);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_TIME.slug}=${POINT_CREATED_AT}`,
          );
        });
      });

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside")
        .should("not.contain.text", DASHBOARD_FILTER_TEXT.name)
        .should("not.contain.text", COUNT_COLUMN_NAME);
    });

    it("allows updating multiple dashboard filters", () => {
      const dashboardDetails = {
        parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
      };

      H.createQuestionAndDashboard({ questionDetails, dashboardDetails }).then(
        ({ body: dashcard }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: dashcard.dashboard_id,
            card_id: dashcard.card_id,
            card: {
              parameter_mappings: [
                createTextFilterMapping({ card_id: dashcard.card_id }),
                createTimeFilterMapping({ card_id: dashcard.card_id }),
              ],
            },
          });
          H.visitDashboard(dashcard.dashboard_id);
          cy.location().then(({ pathname }) => {
            cy.wrap(pathname).as("originalPathname");
          });
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside").findByText("Update a dashboard filter").click();
      addTextParameter();
      addTimeParameter();
      cy.get("aside").button("Done").click();

      H.saveDashboard({ waitMs: 250 });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 2)
        .should("contain.text", POINT_COUNT)
        .should("contain.text", POINT_CREATED_AT_FORMATTED);
      cy.get("@originalPathname").then((originalPathname) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(originalPathname);
          expect(search).to.equal(
            `?${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}&${DASHBOARD_FILTER_TIME.slug}=${POINT_CREATED_AT}`,
          );
        });
      });
    });
  });

  describe("table", () => {
    const questionDetails = QUESTION_TABLE;
    const dashboardDetails = {
      parameters: [DASHBOARD_FILTER_TEXT],
    };

    it("should open drill-through menu as a default click-behavior", () => {
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      getTableCell(COLUMN_INDEX.COUNT).click();
      H.popover().should("contain.text", "Filter by this value");

      getTableCell(COLUMN_INDEX.CREATED_AT).click();
      H.popover().should("contain.text", "Filter by this date and time");

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      H.getDashboardCard()
        .button()
        .should("have.text", "Open the drill-through menu");
    });

    it(
      "should allow setting dashboard and saved question as custom destination for different columns",
      { tags: "@flaky" },
      () => {
        H.createQuestion(TARGET_QUESTION);
        H.createDashboard(
          {
            ...TARGET_DASHBOARD,
            parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
            dashcards: [
              createMockDashboardCard({
                card_id: ORDERS_QUESTION_ID,
                parameter_mappings: [
                  createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
                  createTimeFilterMapping({ card_id: ORDERS_QUESTION_ID }),
                ],
              }),
            ],
          },
          {
            wrapId: true,
            idAlias: "targetDashboardId",
          },
        );
        H.createQuestionAndDashboard({ questionDetails }).then(
          ({ body: card }) => {
            H.visitDashboard(card.dashboard_id);
          },
        );

        H.editDashboard();

        H.getDashboardCard().realHover().icon("click").click();

        (function addCustomDashboardDestination() {
          cy.log("custom destination (dashboard) behavior for 'Count' column");

          getCountToDashboardMapping().should("not.exist");
          cy.get("aside").findByText(COUNT_COLUMN_NAME).click();
          addDashboardDestination();
          cy.get("aside")
            .findByText("Select a dashboard tab")
            .should("not.exist");
          cy.get("aside")
            .findByText("No available targets")
            .should("not.exist");
          addTextParameter();
          addTimeParameter();
          customizeLinkText(`Count: {{${COUNT_COLUMN_ID}}}`);

          cy.icon("chevronleft").click();

          getCountToDashboardMapping().should("exist");
          H.getDashboardCard()
            .button()
            .should("have.text", "1 column has custom behavior");
        })();

        (function addCustomQuestionDestination() {
          cy.log(
            "custom destination (question) behavior for 'Created at' column",
          );

          getCreatedAtToQuestionMapping().should("not.exist");
          cy.get("aside").findByText(CREATED_AT_COLUMN_NAME).click();
          addSavedQuestionDestination();
          addSavedQuestionCreatedAtParameter();
          addSavedQuestionQuantityParameter();
          customizeLinkText(`Created at: {{${CREATED_AT_COLUMN_ID}}}`);

          cy.icon("chevronleft").click();

          getCreatedAtToQuestionMapping().should("exist");
          H.getDashboardCard()
            .button()
            .should("have.text", "2 columns have custom behavior");
        })();

        cy.get("aside").button("Done").click();
        H.saveDashboard({ waitMs: 500 });

        (function testDashboardDestinationClick() {
          cy.log("it handles 'Count' column click");

          getTableCell(COLUMN_INDEX.COUNT)
            .should("have.text", `Count: ${POINT_COUNT}`)
            .click();

          cy.get("@targetDashboardId").then((targetDashboardId) => {
            cy.location().should(({ pathname, search }) => {
              expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
              expect(search).to.equal(
                `?${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}&${DASHBOARD_FILTER_TIME.slug}=${POINT_CREATED_AT}`,
              );
            });
          });

          cy.findAllByTestId("parameter-widget")
            .should("have.length", 2)
            .should("contain.text", POINT_COUNT)
            .should("contain.text", POINT_CREATED_AT_FORMATTED);
        })();

        cy.go("back");

        (function testQuestionDestinationClick() {
          cy.log("it handles 'Created at' column click");

          getTableCell(COLUMN_INDEX.CREATED_AT)
            .should("have.text", `Created at: ${POINT_CREATED_AT_FORMATTED}`)
            .click();
          cy.wait("@dataset");
          cy.findByTestId("qb-filters-panel")
            .should("contain.text", "Created At is Jul 1–31, 2022")
            .should("contain.text", "Quantity is equal to 64");

          cy.location("pathname").should("equal", "/question");
          cy.findByTestId("app-bar").should(
            "contain.text",
            `Started from ${TARGET_QUESTION.name}`,
          );
          verifyVizTypeIsLine();

          H.openNotebook();
          H.verifyNotebookQuery("Orders", [
            {
              filters: [
                "Created At is Jul 1–31, 2022",
                "Quantity is equal to 64",
              ],
              aggregations: ["Count"],
              breakouts: ["Created At: Month"],
              limit: 5,
            },
          ]);
        })();
      },
    );

    it("should allow setting dashboard tab with parameter for a column", () => {
      H.createQuestion(TARGET_QUESTION);

      const dashboard = {
        ...TARGET_DASHBOARD,
        parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
      };

      const tabs = [FIRST_TAB, SECOND_TAB, THIRD_TAB];

      const options = {
        wrapId: true,
        idAlias: "targetDashboardId",
      };

      createDashboardWithTabsLocal({
        dashboard,
        tabs,
        dashcards: [
          createMockDashboardCard({
            dashboard_tab_id: SECOND_TAB.id,
            card_id: ORDERS_QUESTION_ID,
            parameter_mappings: [
              createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
              createTimeFilterMapping({ card_id: ORDERS_QUESTION_ID }),
            ],
          }),
        ],
        options,
      });

      const TAB_SLUG_MAP = {};
      tabs.forEach((tab) => {
        cy.get(`@${tab.name}-id`).then((tabId) => {
          TAB_SLUG_MAP[tab.name] = `${tabId}-${tab.name}`;
        });
      });

      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      cy.get("aside").findByText(COUNT_COLUMN_NAME).click();
      addDashboardDestination();
      cy.get("aside")
        .findByLabelText("Select a dashboard tab")
        .should("have.value", FIRST_TAB.name)
        .click();
      cy.findByRole("listbox").findByText(SECOND_TAB.name).click();
      cy.get("aside").findByText("No available targets").should("not.exist");
      addTextParameter();

      cy.icon("chevronleft").click();

      getCountToDashboardMapping().should("exist");
      H.getDashboardCard()
        .button()
        .should("have.text", "1 column has custom behavior");

      cy.get("aside").button("Done").click();
      H.saveDashboard({ waitMs: 250 });

      getTableCell(COLUMN_INDEX.COUNT)
        .should("have.text", String(POINT_COUNT))
        .click();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 2)
        .should("contain.text", POINT_COUNT);

      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.location().should(({ pathname, search }) => {
          expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
          const tabParam = `tab=${TAB_SLUG_MAP[SECOND_TAB.name]}`;
          const textFilterParam = `${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}`;
          const timeFilterParam = `${DASHBOARD_FILTER_TIME.slug}=`;
          expect(search).to.equal(
            `?${textFilterParam}&${timeFilterParam}&${tabParam}`,
          );
        });
      });
    });

    it("should allow setting URL as custom destination and updating dashboard filters for different columns", () => {
      H.createQuestion(TARGET_QUESTION);
      H.createDashboard(
        {
          ...TARGET_DASHBOARD,
          parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
          dashcards: [
            createMockDashboardCard({
              card_id: ORDERS_QUESTION_ID,
              parameter_mappings: [
                createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
                createTimeFilterMapping({ card_id: ORDERS_QUESTION_ID }),
              ],
            }),
          ],
        },
        {
          wrapId: true,
          idAlias: "targetDashboardId",
        },
      );
      H.createQuestionAndDashboard({ questionDetails, dashboardDetails }).then(
        ({ body: dashcard }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: dashcard.dashboard_id,
            card_id: dashcard.card_id,
            card: {
              parameter_mappings: [
                createTextFilterMapping({ card_id: dashcard.card_id }),
              ],
            },
          });
          H.visitDashboard(dashcard.dashboard_id);
          cy.location().then(({ pathname }) => {
            cy.wrap(pathname).as("originalPathname");
          });
        },
      );

      H.editDashboard();

      H.getDashboardCard().realHover();
      cy.icon("click").click();

      (function addUpdateDashboardFilters() {
        cy.log("update dashboard filters behavior for 'Count' column");

        getCountToDashboardFilterMapping().should("not.exist");
        cy.get("aside").findByText(COUNT_COLUMN_NAME).click();
        cy.get("aside").findByText("Update a dashboard filter").click();
        addTextParameter();
        cy.get("aside").findByRole("textbox").should("not.exist");

        cy.icon("chevronleft").click();

        getCountToDashboardFilterMapping().should("exist");
      })();

      H.getDashboardCard()
        .button()
        .should("have.text", "1 column has custom behavior");

      (function addCustomUrlDestination() {
        cy.log("custom destination (URL) behavior for 'Created At' column");

        getCreatedAtToUrlMapping().should("not.exist");
        cy.get("aside").findByText(CREATED_AT_COLUMN_NAME).click();
        addUrlDestination();
        H.modal().within(() => {
          cy.findAllByRole("textbox")
            .eq(0)
            .as("urlInput")
            .type(URL_WITH_PARAMS, {
              parseSpecialCharSequences: false,
            });
          cy.findAllByRole("textbox")
            .eq(1)
            .as("customLinkTextInput")
            .type(`Created at: {{${CREATED_AT_COLUMN_ID}}}`, {
              parseSpecialCharSequences: false,
            })
            .blur();

          cy.button("Done").click();
        });

        cy.icon("chevronleft").click();

        getCreatedAtToUrlMapping().should("exist");
      })();

      H.getDashboardCard()
        .button()
        .should("have.text", "2 columns have custom behavior");

      cy.get("aside").button("Done").click();
      H.saveDashboard({ waitMs: 250 });

      (function testUpdateDashboardFiltersClick() {
        cy.log("it handles 'Count' column click");

        getTableCell(COLUMN_INDEX.COUNT).click();
        cy.findAllByTestId("parameter-widget")
          .should("have.length", 1)
          .should("contain.text", POINT_COUNT);
        cy.get("@originalPathname").then((originalPathname) => {
          cy.location().should(({ pathname, search }) => {
            expect(pathname).to.equal(originalPathname);
            expect(search).to.equal(
              `?${DASHBOARD_FILTER_TEXT.slug}=${POINT_COUNT}`,
            );
          });
        });
      })();

      (function testCustomUrlDestinationClick() {
        cy.log("it handles 'Created at' column click");

        cy.button(DASHBOARD_FILTER_TEXT.name).click();
        H.dashboardParametersPopover().within(() => {
          H.removeFieldValuesValue(0);
          cy.findByPlaceholderText("Search the list").type("Dell Adams");
          cy.button("Update filter").click();
        });
        onNextAnchorClick((anchor) => {
          expect(anchor).to.have.attr("href", URL_WITH_FILLED_PARAMS);
          expect(anchor).to.have.attr("rel", "noopener");
          expect(anchor).to.have.attr("target", "_blank");
        });
        getTableCell(COLUMN_INDEX.CREATED_AT)
          .should("have.text", "Created at: October 2023")
          .click();
      })();
    });
  });

  describe("interactive embedding", () => {
    const questionDetails = QUESTION_LINE_CHART;

    beforeEach(() => {
      cy.intercept("GET", "/api/embed/dashboard/*").as("dashboard");
      cy.intercept("GET", "/api/embed/dashboard/**/card/*").as("cardQuery");
    });

    it("does not allow opening custom dashboard destination", () => {
      const dashboardDetails = {
        enable_embedding: true,
        embedding_params: {},
      };

      H.createDashboard(
        {
          ...TARGET_DASHBOARD,
          enable_embedding: true,
          embedding_params: {},
        },
        {
          wrapId: true,
          idAlias: "targetDashboardId",
        },
      );
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        H.createQuestionAndDashboard({
          questionDetails,
          dashboardDetails,
        }).then(({ body: card }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: card.dashboard_id,
            card_id: card.card_id,
            card: {
              id: card.id,
              visualization_settings: {
                click_behavior: {
                  parameterMapping: {},
                  targetId: targetDashboardId,
                  linkType: "dashboard",
                  type: "link",
                },
              },
            },
          });

          H.visitEmbeddedPage({
            resource: { dashboard: card.dashboard_id },
            params: {},
          });
          cy.wait("@dashboard");
          cy.wait("@cardQuery");
        });
      });

      cy.url().then((originalUrl) => {
        clickLineChartPoint();
        cy.url().should("eq", originalUrl);
      });
      cy.get("header").findByText(TARGET_DASHBOARD.name).should("not.exist");
    });

    it("does not allow opening custom question destination", () => {
      const dashboardDetails = {
        enable_embedding: true,
        embedding_params: {},
      };

      H.createQuestion(
        {
          ...TARGET_QUESTION,
          enable_embedding: true,
          embedding_params: {},
        },
        {
          wrapId: true,
          idAlias: "targetQuestionId",
        },
      );
      cy.get("@targetQuestionId").then((targetQuestionId) => {
        H.createQuestionAndDashboard({
          questionDetails,
          dashboardDetails,
        }).then(({ body: card }) => {
          H.addOrUpdateDashboardCard({
            dashboard_id: card.dashboard_id,
            card_id: card.card_id,
            card: {
              id: card.id,
              visualization_settings: {
                click_behavior: {
                  parameterMapping: {},
                  targetId: targetQuestionId,
                  linkType: "question",
                  type: "link",
                },
              },
            },
          });

          H.visitEmbeddedPage({
            resource: { dashboard: card.dashboard_id },
            params: {},
          });
          cy.wait("@dashboard");
          cy.wait("@cardQuery");
        });
      });

      cy.url().then((originalUrl) => {
        clickLineChartPoint();
        cy.url().should("eq", originalUrl);
      });
      cy.get("header").findByText(TARGET_QUESTION.name).should("not.exist");
    });

    it("allows opening custom URL destination with parameters", () => {
      const dashboardDetails = {
        parameters: [DASHBOARD_FILTER_TEXT],
        enable_embedding: true,
        embedding_params: {
          [DASHBOARD_FILTER_TEXT.slug]: "enabled",
        },
      };

      H.createQuestionAndDashboard({
        questionDetails,
        dashboardDetails,
      }).then(({ body: dashCard }) => {
        H.addOrUpdateDashboardCard({
          dashboard_id: dashCard.dashboard_id,
          card_id: dashCard.card_id,
          card: {
            id: dashCard.id,
            parameter_mappings: [
              createTextFilterMapping({ card_id: dashCard.card_id }),
            ],
            visualization_settings: {
              click_behavior: {
                type: "link",
                linkType: "url",
                linkTemplate: URL_WITH_PARAMS,
              },
            },
          },
        });

        H.visitEmbeddedPage({
          resource: { dashboard: dashCard.dashboard_id },
          params: {},
        });
        cy.wait("@dashboard");
        cy.wait("@cardQuery");
      });

      cy.button(DASHBOARD_FILTER_TEXT.name).click();
      H.dashboardParametersPopover().within(() => {
        cy.findByPlaceholderText("Search the list").type("Dell Adams");
        cy.button("Add filter").click();
      });
      onNextAnchorClick((anchor) => {
        expect(anchor).to.have.attr("href", URL_WITH_FILLED_PARAMS);
        expect(anchor).to.have.attr("rel", "noopener");
        expect(anchor).to.have.attr("target", "_blank");
      });
      clickLineChartPoint();
    });

    it("allows opening custom URL destination that is not a Metabase instance URL using link (metabase#33379)", () => {
      H.updateSetting("site-url", "https://localhost:4000/subpath");
      const dashboardDetails = {
        enable_embedding: true,
      };

      const metabaseInstanceUrl = "http://localhost:4000";
      H.createQuestionAndDashboard({
        questionDetails,
        dashboardDetails,
      }).then(({ body: card }) => {
        H.addOrUpdateDashboardCard({
          dashboard_id: card.dashboard_id,
          card_id: card.card_id,
          card: {
            id: card.id,
            visualization_settings: {
              click_behavior: {
                type: "link",
                linkType: "url",
                linkTemplate: `${metabaseInstanceUrl}/404`,
              },
            },
          },
        });

        H.visitEmbeddedPage({
          resource: { dashboard: card.dashboard_id },
          params: {},
        });
        cy.wait("@dashboard");
        cy.wait("@cardQuery");
      });

      clickLineChartPoint();

      cy.log(
        "This is app 404 page, the embed 404 page will have different copy",
      );
      cy.findByRole("main")
        .findByText("The page you asked for couldn't be found.")
        .should("be.visible");
    });

    it("allows updating multiple dashboard filters", () => {
      const dashboardDetails = {
        parameters: [DASHBOARD_FILTER_TEXT, DASHBOARD_FILTER_TIME],
        enable_embedding: true,
        embedding_params: {
          [DASHBOARD_FILTER_TEXT.slug]: "enabled",
          [DASHBOARD_FILTER_TIME.slug]: "enabled",
        },
      };
      const countParameterId = "1";
      const createdAtParameterId = "2";

      H.createQuestionAndDashboard({
        questionDetails,
        dashboardDetails,
      }).then(({ body: dashCard }) => {
        H.addOrUpdateDashboardCard({
          dashboard_id: dashCard.dashboard_id,
          card_id: dashCard.card_id,
          card: {
            id: dashCard.id,
            parameter_mappings: [
              createTextFilterMapping({ card_id: dashCard.card_id }),
              createTimeFilterMapping({ card_id: dashCard.card_id }),
            ],
            visualization_settings: {
              click_behavior: {
                type: "crossfilter",
                parameterMapping: {
                  [countParameterId]: {
                    source: COUNT_COLUMN_SOURCE,
                    target: { type: "parameter", id: countParameterId },
                    id: countParameterId,
                  },
                  [createdAtParameterId]: {
                    source: CREATED_AT_COLUMN_SOURCE,
                    target: { type: "parameter", id: createdAtParameterId },
                    id: createdAtParameterId,
                  },
                },
              },
            },
          },
        });

        H.visitEmbeddedPage({
          resource: { dashboard: dashCard.dashboard_id },
          params: {},
        });
        cy.wait("@dashboard");
        cy.wait("@cardQuery");
      });

      clickLineChartPoint();
      cy.findAllByTestId("parameter-widget")
        .should("have.length", 2)
        .should("contain.text", POINT_COUNT)
        .should("contain.text", POINT_CREATED_AT_FORMATTED);
    });
  });

  describe("static embedding", () => {
    it("should navigate to public link URL (metabase#38640)", () => {
      H.createDashboard(TARGET_DASHBOARD)
        .then(({ body: { id: dashboardId } }) => {
          cy.log("create a public link for this dashboard");
          cy.request("POST", `/api/dashboard/${dashboardId}/public_link`).then(
            ({ body: { uuid } }) => {
              cy.wrap(uuid);
            },
          );
        })
        .then((uuid) => {
          H.createQuestionAndDashboard({
            dashboardDetails: {
              name: "Dashboard",
              enable_embedding: true,
            },
            questionDetails: QUESTION_LINE_CHART,
            cardDetails: {
              // Set custom URL click behavior via API
              visualization_settings: {
                click_behavior: {
                  type: "link",
                  linkType: "url",
                  linkTemplate: `http://localhost:4000/public/dashboard/${uuid}`,
                },
              },
            },
          });
        })
        .then(({ body: dashCard }) => {
          H.visitDashboard(dashCard.dashboard_id);
        });

      H.openStaticEmbeddingModal({
        activeTab: "parameters",
        acceptTerms: false,
      });
      H.visitIframe();
      clickLineChartPoint();

      cy.findByRole("heading", { name: TARGET_DASHBOARD.name }).should(
        "be.visible",
      );
    });
  });

  describe("multi-stage questions as target destination", () => {
    const questionDetails = {
      name: "Table",
      query: {
        aggregation: [["count"]],
        breakout: [
          [
            "field",
            ORDERS.CREATED_AT,
            { "base-type": "type/DateTime", "temporal-unit": "month" },
          ],
          [
            "field",
            PRODUCTS.CATEGORY,
            { "base-type": "type/Text", "source-field": ORDERS.PRODUCT_ID },
          ],
          ["field", ORDERS.ID, { "base-type": "type/BigInteger" }],
          [
            "field",
            PEOPLE.LONGITUDE,
            {
              "base-type": "type/Float",
              binning: {
                strategy: "default",
              },
              "source-field": ORDERS.USER_ID,
            },
          ],
        ],
        "source-table": ORDERS_ID,
        limit: 5,
      },
    };

    const targetQuestion = {
      name: "Target question",
      query: createMultiStageQuery(),
    };

    it("should allow navigating to questions with filters applied in every stage", () => {
      H.createQuestion(targetQuestion);
      H.createQuestionAndDashboard({ questionDetails }).then(
        ({ body: card }) => {
          H.visitDashboard(card.dashboard_id);
        },
      );

      H.editDashboard();
      H.getDashboardCard().realHover().icon("click").click();

      cy.get("aside").findByText(CREATED_AT_COLUMN_NAME).click();
      addSavedQuestionDestination();

      verifyAvailableClickTargetColumns([
        // 1st stage - Orders
        "ID",
        "User ID",
        "Product ID",
        "Subtotal",
        "Tax",
        "Total",
        "Discount",
        "Created At",
        "Quantity",
        // 1st stage - Custom columns
        "Net",
        // 1st stage - Reviews #1 (explicit join)
        "Reviews - Product → ID",
        "Reviews - Product → Product ID",
        "Reviews - Product → Reviewer",
        "Reviews - Product → Rating",
        "Reviews - Product → Body",
        "Reviews - Product → Created At",
        // 1st stage - Products (implicit join with Orders)
        "Product → ID",
        "Product → Ean",
        "Product → Title",
        "Product → Category",
        "Product → Vendor",
        "Product → Price",
        "Product → Rating",
        "Product → Created At",
        // 1st stage - People (implicit join with Orders)
        "User → ID",
        "User → Address",
        "User → Email",
        "User → Password",
        "User → Name",
        "User → City",
        "User → Longitude",
        "User → State",
        "User → Source",
        "User → Birth Date",
        "User → Zip",
        "User → Latitude",
        "User → Created At",
        // 1st stage - Products (implicit join with Reviews)
        "Product → ID",
        "Product → Ean",
        "Product → Title",
        "Product → Category",
        "Product → Vendor",
        "Product → Price",
        "Product → Rating",
        "Product → Created At",
        // 1st stage - Aggregations & breakouts
        "Created At: Month",
        "Product → Category",
        "User → Created At: Year",
        "Count",
        "Sum of Total",
        // 2nd stage - Custom columns
        "5 * Count",
        // 2nd stage - Reviews #2 (explicit join)
        "Reviews - Created At: Month → ID",
        "Reviews - Created At: Month → Product ID",
        "Reviews - Created At: Month → Reviewer",
        "Reviews - Created At: Month → Rating",
        "Reviews - Created At: Month → Body",
        "Reviews - Created At: Month → Created At",
        // 2nd stage - Aggregations & breakouts
        "Product → Category",
        "Reviews - Created At: Month → Created At",
        "Count",
        "Sum of Reviews - Created At: Month → Rating",
      ]);

      // 1st stage - Orders
      getClickMapping("ID").click();
      H.popover().findByText("ID").click();

      // 1st stage - Custom columns
      getClickMapping("Net").click();
      H.popover().findByText("User → Longitude: 10°").click();

      // 1st stage - Reviews #1 (explicit join)
      getClickMapping("Reviews - Product → Reviewer").click();
      H.popover().findByText("Product → Category").click();

      // 1st stage - Products (implicit join with Orders)
      getClickMapping("Product → Title").first().click();
      H.popover().findByText("Product → Category").click();

      // 1st stage - People (implicit join with Orders)
      getClickMapping("User → Longitude").click();
      H.popover().findByText("User → Longitude: 10°").click();

      // 1st stage - Products (implicit join with Reviews)
      // eslint-disable-next-line no-unsafe-element-filtering
      getClickMapping("Product → Vendor").last().click();
      H.popover().findByText("Product → Category").click();

      // 1st stage - Aggregations & breakouts
      getClickMapping("Product → Category").eq(2).click();
      H.popover().findByText("Product → Category").click();

      // 2nd stage - Custom columns
      getClickMapping("5 * Count").click();
      H.popover().findByText("Count").click();

      // 2nd stage - Reviews #2 (explicit join)
      getClickMapping("Reviews - Created At: Month → Rating").click();
      H.popover().findByText("ID").click();

      // 2nd stage - Aggregations & breakouts
      // eslint-disable-next-line no-unsafe-element-filtering
      getClickMapping("Count").last().click();
      H.popover().findByText("User → Longitude: 10°").click();

      customizeLinkText(`Created at: {{${CREATED_AT_COLUMN_ID}}} - {{count}}`);

      cy.get("aside").button("Done").click();
      H.saveDashboard({ waitMs: 250 });

      H.getDashboardCard()
        .findAllByText("Created at: May 2022 - 1")
        .first()
        .click();

      cy.wait("@dataset");

      cy.location("pathname").should("equal", "/question");
      cy.findByTestId("app-bar").should(
        "contain.text",
        `Started from ${targetQuestion.name}`,
      );

      // TODO: https://github.com/metabase/metabase/issues/46774
      // queryBuilderMain()
      //   .findByText("There was a problem with your question")
      //   .should("not.exist");
      // queryBuilderMain().findByText("No results!").should("be.visible");

      H.openNotebook();
      H.verifyNotebookQuery("Orders", [
        {
          joins: [
            {
              lhsTable: "Orders",
              rhsTable: "Reviews",
              type: "left-join",
              conditions: [
                {
                  operator: "=",
                  lhsColumn: "Product ID",
                  rhsColumn: "Product ID",
                },
              ],
            },
          ],
          expressions: ["Net"],
          filters: [
            "Product → Title is Doohickey",
            "Product → Vendor is Doohickey",
            "ID is 7021",
            "Net is equal to -80",
            "Reviews - Product → Reviewer is Doohickey",
            "User → Longitude is equal to -80",
          ],
          aggregations: ["Count", "Sum of Total"],
          breakouts: [
            "Created At: Month",
            "Product → Category",
            "User → Created At: Year",
          ],
        },
        {
          joins: [
            {
              lhsTable: "Orders",
              rhsTable: "Reviews",
              type: "left-join",
              conditions: [
                {
                  operator: "=",
                  lhsColumn: "Created At: Month",
                  rhsColumn: "Created At: Month",
                },
              ],
            },
          ],
          expressions: ["5 * Count"],
          filters: [
            "5 * Count is equal to 1",
            "Reviews - Created At: Month → Rating is equal to 7021",
            "Product → Category is Doohickey",
          ],
          aggregations: [
            "Count",
            "Sum of Reviews - Created At: Month → Rating",
          ],
          breakouts: [
            "Product → Category",
            "Reviews - Created At: Month → Created At",
          ],
        },
        {
          filters: ["Count is equal to -80"],
        },
      ]);
    });
  });

  it("should navigate to a different tab on the same dashboard when configured (metabase#39319)", () => {
    const TAB_1 = {
      id: 1,
      name: "first-tab",
    };
    const TAB_2 = {
      id: 2,
      name: "second-tab",
    };
    const tabs = [TAB_1, TAB_2];
    const FILTER_MAPPING_COLUMN = "User ID";
    const DASHBOARD_TEXT_FILTER = {
      id: "1",
      name: "Text filter",
      slug: "filter-text",
      type: "string/contains",
    };

    H.createDashboardWithTabs({
      name: TARGET_DASHBOARD.name,
      tabs,
      parameters: [{ ...DASHBOARD_TEXT_FILTER }],
      dashcards: [
        createMockDashboardCard({
          id: -1,
          card_id: ORDERS_QUESTION_ID,
          size_x: 12,
          size_y: 6,
          dashboard_tab_id: TAB_1.id,
          parameter_mappings: [
            createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
          ],
        }),
        createMockDashboardCard({
          id: -2,
          card_id: ORDERS_BY_YEAR_QUESTION_ID,
          size_x: 12,
          size_y: 6,
          dashboard_tab_id: TAB_2.id,
          parameter_mappings: [
            createTextFilterMapping({ card_id: ORDERS_BY_YEAR_QUESTION_ID }),
          ],
        }),
      ],
    }).then((dashboard) => {
      cy.wrap(dashboard.id).as("targetDashboardId");
      dashboard.tabs.forEach((tab) => {
        cy.wrap(tab.id).as(`${tab.name}-id`);
      });
      H.visitDashboard(dashboard.id);
    });

    const TAB_SLUG_MAP = {};
    tabs.forEach((tab) => {
      cy.get(`@${tab.name}-id`).then((tabId) => {
        TAB_SLUG_MAP[tab.name] = `${tabId}-${tab.name}`;
      });
    });

    H.editDashboard();

    H.getDashboardCard().realHover().icon("click").click();
    cy.get("aside").findByText(FILTER_MAPPING_COLUMN).click();
    addDashboardDestination();
    cy.get("aside")
      .findByLabelText("Select a dashboard tab")
      .should("have.value", TAB_1.name)
      .click();
    cy.findByRole("listbox").findByText(TAB_2.name).click();
    cy.get("aside").findByText(DASHBOARD_TEXT_FILTER.name).click();
    H.popover().findByText(FILTER_MAPPING_COLUMN).click();

    cy.get("aside").button("Done").click();
    H.saveDashboard({ waitMs: 250 });

    // test click behavior routing to same dashboard, different tab
    getTableCell(1).click();
    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal(
          `?${DASHBOARD_FILTER_TEXT.slug}=${1}&tab=${TAB_SLUG_MAP[TAB_2.name]}`,
        );
      });
    });
  });

  it("should allow click behavior on left/top header rows on a pivot table (metabase#25203)", () => {
    const QUESTION_NAME = "Cypress Pivot Table";
    const DASHBOARD_NAME = "Pivot Table Dashboard";
    const testQuery = {
      type: "query",
      query: {
        "source-table": ORDERS_ID,
        aggregation: [["count"]],
        breakout: [
          [
            "field",
            PEOPLE.SOURCE,
            { "base-type": "type/Text", "source-field": ORDERS.USER_ID },
          ],
          [
            "field",
            PRODUCTS.CATEGORY,
            { "base-type": "type/Text", "source-field": ORDERS.PRODUCT_ID },
          ],
        ],
      },
      database: SAMPLE_DB_ID,
    };

    H.createQuestionAndDashboard({
      questionDetails: {
        name: QUESTION_NAME,
        query: testQuery.query,
        display: "pivot",
      },
      dashboardDetails: {
        name: DASHBOARD_NAME,
      },
      cardDetails: {
        size_x: 16,
        size_y: 8,
      },
    }).then(({ body: { dashboard_id } }) => {
      cy.wrap(dashboard_id).as("targetDashboardId");
      H.visitDashboard(dashboard_id);
    });

    H.editDashboard();

    H.getDashboardCard().realHover().icon("click").click();
    addUrlDestination();

    H.modal().within(() => {
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.findAllByRole("textbox")
          .eq(0)
          .as("urlInput")
          .type(
            `http://localhost:4000/dashboard/${targetDashboardId}?source={{source}}&category={{category}}&count={{count}}`,
            {
              parseSpecialCharSequences: false,
            },
          );
      });
      cy.button("Done").click();
    });

    cy.get("aside").button("Done").click();

    H.saveDashboard();

    // test top header row
    H.getDashboardCard().findByText("Doohickey").click();
    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal("?category=Doohickey&count=&source=");
      });
    });

    // test left header row
    H.getDashboardCard().findByText("Affiliate").click();
    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal("?category=&count=&source=Affiliate");
      });
    });
  });

  it("should allow click through on the pivot column of a regular table that has been pivoted (metabase#25203)", () => {
    const QUESTION_NAME = "Cypress Table Pivoted";
    const DASHBOARD_NAME = "Table Pivoted Dashboard";
    const testQuery = {
      type: "query",
      query: {
        "source-table": ORDERS_ID,
        aggregation: [["count"]],
        breakout: [
          [
            "field",
            PEOPLE.SOURCE,
            { "base-type": "type/Text", "source-field": ORDERS.USER_ID },
          ],
          [
            "field",
            PRODUCTS.CATEGORY,
            { "base-type": "type/Text", "source-field": ORDERS.PRODUCT_ID },
          ],
        ],
      },
      database: SAMPLE_DB_ID,
    };

    H.createQuestionAndDashboard({
      questionDetails: {
        name: QUESTION_NAME,
        query: testQuery.query,
        display: "table",
      },
      dashboardDetails: {
        name: DASHBOARD_NAME,
      },
      cardDetails: {
        size_x: 16,
        size_y: 8,
      },
    }).then(({ body: { dashboard_id } }) => {
      cy.wrap(dashboard_id).as("targetDashboardId");
      H.visitDashboard(dashboard_id);
    });

    H.editDashboard();

    H.getDashboardCard().realHover().icon("click").click();
    cy.get("aside").findByText("User → Source").click();
    addUrlDestination();

    H.modal().within(() => {
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.findAllByRole("textbox")
          .eq(0)
          .as("urlInput")
          .type(
            `http://localhost:4000/dashboard/${targetDashboardId}?source={{source}}`,
            {
              parseSpecialCharSequences: false,
            },
          );
      });
      cy.button("Done").click();
    });

    cy.get("aside").button("Done").click();

    H.saveDashboard();

    // test pivoted column
    H.getDashboardCard().findByText("Organic").click();
    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal("?source=Organic");
      });
    });
  });

  it("should not pass through null values to filters in custom url click behavior (metabase#25203)", () => {
    const DASHBOARD_NAME = "Click Behavior Custom URL Dashboard";
    const questionDetails = {
      name: "Orders",
      query: {
        "source-table": ORDERS_ID,
        aggregation: [
          ["sum", ["field", ORDERS.TOTAL, null]],
          ["sum", ["field", ORDERS.DISCOUNT, null]],
        ],
        breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }]],
        filter: ["=", ["field", ORDERS.USER_ID, null], 1],
      },
      display: "bar",
    };

    H.createQuestionAndDashboard({
      questionDetails,
      dashboardDetails: {
        name: DASHBOARD_NAME,
      },
      cardDetails: {
        size_x: 16,
        size_y: 8,
      },
    }).then(({ body: { dashboard_id } }) => {
      cy.wrap(dashboard_id).as("targetDashboardId");
      H.visitDashboard(dashboard_id);
    });

    H.editDashboard();

    H.getDashboardCard().realHover().icon("click").click();
    addUrlDestination();

    H.modal().within(() => {
      cy.get("@targetDashboardId").then((targetDashboardId) => {
        cy.findAllByRole("textbox")
          .eq(0)
          .as("urlInput")
          .type(
            `http://localhost:4000/dashboard/${targetDashboardId}?discount={{sum_2}}&total={{sum}}`,
            {
              parseSpecialCharSequences: false,
            },
          );
      });
      cy.button("Done").click();
    });

    cy.get("aside").button("Done").click();

    H.saveDashboard();

    // test that normal values still work properly
    H.getDashboardCard().within(() => {
      H.chartPathWithFillColor("#88BF4D").eq(2).click();
    });
    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal(
          "?discount=15.070632139056723&total=298.9195210424866",
        );
      });
    });

    // test that null and "empty"s do not get passed through
    H.getDashboardCard().within(() => {
      H.chartPathWithFillColor("#88BF4D").eq(1).click();
    });
    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal("?discount=&total=420.3189231596888");
      });
    });
  });

  it("should navigate to correct dashboard tab via custom destination click behavior (metabase#34447 metabase#44106)", () => {
    H.createDashboardWithTabs({
      name: TARGET_DASHBOARD.name,
      tabs: [
        {
          id: -1,
          name: "first-tab",
        },
        {
          id: -2,
          name: "second-tab",
        },
      ],
    }).then((targetDashboard) => {
      const baseClickBehavior = {
        type: "link",
        linkType: "dashboard",
        targetId: targetDashboard.id,
        parameterMapping: {},
      };

      const [firstTab, secondTab] = targetDashboard.tabs;

      H.createDashboard({
        dashcards: [
          createMockDashboardCard({
            id: -1,
            card_id: ORDERS_QUESTION_ID,
            size_x: 12,
            size_y: 6,
            visualization_settings: {
              click_behavior: {
                ...baseClickBehavior,
                tabId: firstTab.id,
              },
            },
          }),
          createMockDashboardCard({
            id: -2,
            card_id: ORDERS_QUESTION_ID,
            size_x: 12,
            size_y: 6,
            visualization_settings: {
              click_behavior: {
                ...baseClickBehavior,
                tabId: secondTab.id,
              },
            },
          }),
        ],
      }).then(({ body: dashboard }) => {
        H.visitDashboard(dashboard.id);

        H.getDashboardCard(1).findByText("14").click();
        cy.location("pathname").should(
          "eq",
          `/dashboard/${targetDashboard.id}`,
        );
        cy.location("search").should("eq", `?tab=${secondTab.id}-second-tab`);

        cy.go("back");
        cy.location("pathname").should("eq", `/dashboard/${dashboard.id}`);
        cy.location("search").should("eq", "");

        H.getDashboardCard(0).findByText("14").click();
        cy.location("pathname").should(
          "eq",
          `/dashboard/${targetDashboard.id}`,
        );
        cy.location("search").should("eq", `?tab=${firstTab.id}-first-tab`);
      });
    });
  });

  it("should handle redirect to a dashboard with a filter, when filter was removed (metabase#35444)", () => {
    const questionDetails = QUESTION_LINE_CHART;
    H.createDashboard(
      {
        ...TARGET_DASHBOARD,
        parameters: [DASHBOARD_FILTER_TEXT],
      },
      {
        wrapId: true,
        idAlias: "targetDashboardId",
      },
    ).then((dashboardId) => {
      cy.request("PUT", `/api/dashboard/${dashboardId}`, {
        dashcards: [
          createMockDashboardCard({
            card_id: ORDERS_QUESTION_ID,
            parameter_mappings: [
              createTextFilterMapping({ card_id: ORDERS_QUESTION_ID }),
            ],
          }),
        ],
      });
    });

    H.createQuestionAndDashboard({ questionDetails }).then(({ body: card }) => {
      H.visitDashboard(card.dashboard_id);

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();
      addDashboardDestination();
      getClickMapping("Text filter").click();

      H.popover().findByText("Count").click();
      H.saveDashboard();
    });

    cy.get("@targetDashboardId").then((targetDashboardId) => {
      cy.log("remove filter from the target dashboard");

      cy.request("PUT", `/api/dashboard/${targetDashboardId}`, {
        parameters: [],
      });

      cy.log(
        "reload source dashboard to apply removed filter of target dashboard in the mappings",
      );

      cy.reload();

      H.editDashboard();

      H.getDashboardCard().realHover().icon("click").click();

      cy.get("aside").should("contain", "No available targets");
      cy.get("aside").button("Done").click();

      H.saveDashboard({ awaitRequest: false });
      cy.wait("@saveDashboard-getDashboard");

      clickLineChartPoint();

      cy.findByTestId("dashboard-header").should(
        "contain",
        TARGET_DASHBOARD.name,
      );

      cy.log("search shouldn't contain `undefined=`");

      cy.location().should(({ pathname, search }) => {
        expect(pathname).to.equal(`/dashboard/${targetDashboardId}`);
        expect(search).to.equal("");
      });
    });
  });

  it("should allow to map numeric columns to user attributes", () => {
    cy.log("set user attributes");
    cy.request("PUT", `/api/user/${NORMAL_USER_ID}`, {
      login_attributes: { attr_uid: NORMAL_USER_ID },
    });

    cy.log("setup a click behavior");
    H.visitDashboard(ORDERS_DASHBOARD_ID);
    H.editDashboard();
    H.showDashboardCardActions();
    H.getDashboardCard().findByLabelText("Click behavior").click();
    H.sidebar().within(() => {
      cy.findByText("Product ID").click();
      cy.findByText("Go to a custom destination").click();
      cy.findByText("Saved question").click();
    });
    H.entityPickerModal().within(() => {
      H.entityPickerModalTab("Questions").click();
      cy.findByText("Orders").click();
    });
    cy.findByTestId("click-mappings").findByText("Product ID").click();
    H.popover().findByText("attr_uid").click();
    H.saveDashboard();

    cy.log("login as a user with a user attribute and ad-hoc query access");
    cy.signInAsNormalUser();

    cy.log("visit the dashboard and click on a cell with the click behavior");
    H.visitDashboard(ORDERS_DASHBOARD_ID);
    H.getDashboardCard().findByText("123").click();
    H.queryBuilderFiltersPanel()
      .findByText(`Product ID is ${NORMAL_USER_ID}`)
      .should("be.visible");
  });
});

/**
 * This function exists to work around custom dynamic anchor creation.
 * @see https://github.com/metabase/metabase/blob/master/frontend/src/metabase/lib/dom.js#L301-L312
 *
 * WARNING: For the assertions to work, ensure that a click event occurs on an anchor element afterwards.
 */
const onNextAnchorClick = (callback) => {
  cy.window().then((window) => {
    const originalClick = window.HTMLAnchorElement.prototype.click;

    window.HTMLAnchorElement.prototype.click = function () {
      callback(this);
      window.HTMLAnchorElement.prototype.click = originalClick;
    };
  });
};

const clickLineChartPoint = () => {
  // eslint-disable-next-line no-unsafe-element-filtering
  H.cartesianChartCircle()
    .eq(POINT_INDEX)
    /**
     * calling .click() here will result in clicking both
     *     g.voronoi > path[POINT_INDEX]
     * and
     *     circle.dot[POINT_INDEX]
     * To make it worse, clicks count won't be deterministic.
     * Sometimes we'll get an error that one element covers the other.
     * This problem prevails when updating dashboard filter,
     * where the 2 clicks will cancel each other out.
     **/
    .then(([circle]) => {
      const { left, top } = circle.getBoundingClientRect();
      cy.get("body").click(left, top);
    });
};

const addDashboardDestination = () => {
  cy.get("aside").findByText("Go to a custom destination").click();
  cy.get("aside").findByText("Dashboard").click();
  H.entityPickerModal()
    .findByRole("tab", { name: /Dashboards/ })
    .click();
  H.entityPickerModal().findByText(TARGET_DASHBOARD.name).click();
};

const addUrlDestination = () => {
  cy.get("aside").findByText("Go to a custom destination").click();
  cy.get("aside").findByText("URL").click();
};

const addSavedQuestionDestination = () => {
  cy.get("aside").findByText("Go to a custom destination").click();
  cy.get("aside").findByText("Saved question").click();
  H.entityPickerModal()
    .findByRole("tab", { name: /Questions/ })
    .click();
  H.entityPickerModal().findByText(TARGET_QUESTION.name).click();
};

const addSavedQuestionCreatedAtParameter = () => {
  cy.get("aside")
    .findByTestId("click-mappings")
    .findByText("Created At")
    .click();
  H.popover().within(() => {
    cy.findByText(COUNT_COLUMN_NAME).should("not.exist");
    cy.findByText(CREATED_AT_COLUMN_NAME).should("exist").click();
  });
};

const addSavedQuestionQuantityParameter = () => {
  cy.get("aside").findByTestId("click-mappings").findByText("Quantity").click();
  H.popover().within(() => {
    cy.findByText(CREATED_AT_COLUMN_NAME).should("not.exist");
    cy.findByText(COUNT_COLUMN_NAME).should("exist").click();
  });
};

const addTextParameter = () => {
  cy.get("aside").findByText(DASHBOARD_FILTER_TEXT.name).click();
  H.popover().within(() => {
    cy.findByText(CREATED_AT_COLUMN_NAME).should("exist");
    cy.findByText(COUNT_COLUMN_NAME).should("exist").click();
  });
};

const addTextWithDefaultParameter = () => {
  cy.get("aside").findByText(DASHBOARD_FILTER_TEXT_WITH_DEFAULT.name).click();
  H.popover().within(() => {
    cy.findByText(CREATED_AT_COLUMN_NAME).should("exist");
    cy.findByText(COUNT_COLUMN_NAME).should("exist").click();
  });
};

const addTimeParameter = () => {
  cy.get("aside").findByText(DASHBOARD_FILTER_TIME.name).click();
  H.popover().within(() => {
    cy.findByText(COUNT_COLUMN_NAME).should("not.exist");
    cy.findByText(CREATED_AT_COLUMN_NAME).should("exist").click();
  });
};

const addNumericParameter = () => {
  cy.get("aside").findByText(DASHBOARD_FILTER_NUMBER.name).click();
  H.popover().within(() => {
    cy.findByText(CREATED_AT_COLUMN_NAME).should("exist");
    cy.findByText(COUNT_COLUMN_NAME).should("exist").click();
  });
};

const createTextFilterMapping = ({ card_id }) => {
  const fieldRef = [
    "field",
    PEOPLE.NAME,
    {
      "base-type": "type/Text",
      "source-field": ORDERS.USER_ID,
    },
  ];

  return {
    card_id,
    parameter_id: DASHBOARD_FILTER_TEXT.id,
    target: ["dimension", fieldRef],
  };
};

const createTextFilterWithDefaultMapping = ({ card_id }) => {
  const fieldRef = [
    "field",
    PEOPLE.NAME,
    {
      "base-type": "type/Text",
      "source-field": ORDERS.USER_ID,
    },
  ];

  return {
    card_id,
    parameter_id: DASHBOARD_FILTER_TEXT_WITH_DEFAULT.id,
    target: ["dimension", fieldRef],
  };
};

const createTimeFilterMapping = ({ card_id }) => {
  const fieldRef = [
    "field",
    ORDERS.CREATED_AT,
    { "base-type": "type/DateTime" },
  ];

  return {
    card_id,
    parameter_id: DASHBOARD_FILTER_TIME.id,
    target: ["dimension", fieldRef],
  };
};

const createNumberFilterMapping = ({ card_id }) => {
  const fieldRef = ["field", ORDERS.QUANTITY, { "base-type": "type/Number" }];

  return {
    card_id,
    parameter_id: DASHBOARD_FILTER_NUMBER.id,
    target: ["dimension", fieldRef],
  };
};

const assertDrillThroughMenuOpen = () => {
  H.popover()
    .should("contain", "See these Orders")
    .and("contain", "See this month by week")
    .and("contain", "Break out by…")
    .and("contain", "Automatic insights…")
    .and("contain", "Filter by this value");
};

const testChangingBackToDefaultBehavior = () => {
  cy.log("allows to change click behavior back to the default");

  H.editDashboard();

  H.getDashboardCard().realHover().icon("click").click();
  cy.get("aside").icon("close").first().click();
  cy.get("aside").findByText("Open the Metabase drill-through menu").click();
  cy.get("aside").button("Done").click();

  H.saveDashboard({ waitMs: 250 });
  // this is necessary due to query params being reset after saving dashboard
  // with filter applied, which causes dashcard to be refetched
  cy.wait(1);

  clickLineChartPoint();
  assertDrillThroughMenuOpen();
};

const getTableCell = (index) => {
  // eslint-disable-next-line no-unsafe-element-filtering
  return cy
    .findAllByRole("row")
    .eq(POINT_INDEX)
    .findAllByTestId("cell-data")
    .eq(index);
};

const getCreatedAtToQuestionMapping = () => {
  return cy
    .get("aside")
    .contains(`${CREATED_AT_COLUMN_NAME} goes to "${TARGET_QUESTION.name}"`);
};

const getCountToDashboardMapping = () => {
  return cy
    .get("aside")
    .contains(`${COUNT_COLUMN_NAME} goes to "${TARGET_DASHBOARD.name}"`);
};

const getCreatedAtToUrlMapping = () => {
  return cy.get("aside").contains(`${CREATED_AT_COLUMN_NAME} goes to URL`);
};

const getCountToDashboardFilterMapping = () => {
  return cy.get("aside").contains(`${COUNT_COLUMN_NAME} updates 1 filter`);
};

const createDashboardWithTabsLocal = ({
  dashboard: dashboardDetails,
  tabs,
  dashcards = [],
  options,
}) => {
  H.createDashboard(dashboardDetails).then(({ body: dashboard }) => {
    if (options?.wrapId) {
      cy.wrap(dashboard.id).as(options.idAlias ?? "dashboardId");
    }
    cy.request("PUT", `/api/dashboard/${dashboard.id}`, {
      ...dashboard,
      dashcards,
      tabs,
    }).then(({ body: dashboard }) => {
      dashboard.tabs.forEach((tab) => {
        cy.wrap(tab.id).as(`${tab.name}-id`);
      });
    });
  });
};

function customizeLinkText(text) {
  cy.get("aside")
    .findByRole("textbox")
    .type(text, { parseSpecialCharSequences: false });
}

function verifyVizTypeIsLine() {
  H.openVizTypeSidebar();
  cy.findByTestId("sidebar-content")
    .findByTestId("Line-container")
    .should("have.attr", "aria-selected", "true");
  H.openVizTypeSidebar();
}

function getClickMapping(columnName) {
  return cy
    .get("aside")
    .findByTestId("unset-click-mappings")
    .findAllByText(columnName);
}

function verifyAvailableClickTargetColumns(columns) {
  cy.get("aside").within(() => {
    for (let index = 0; index < columns.length; ++index) {
      // eslint-disable-next-line no-unsafe-element-filtering
      cy.findAllByTestId("click-target-column")
        .eq(index)
        .should("have.text", columns[index]);
    }

    cy.findAllByTestId("click-target-column").should(
      "have.length",
      columns.length,
    );
  });
}

function createMultiStageQuery() {
  return {
    "source-query": {
      "source-table": ORDERS_ID,
      joins: [
        {
          strategy: "left-join",
          alias: "Reviews - Product",
          condition: [
            "=",
            [
              "field",
              ORDERS.PRODUCT_ID,
              {
                "base-type": "type/Integer",
              },
            ],
            [
              "field",
              "PRODUCT_ID",
              {
                "base-type": "type/Integer",
                "join-alias": "Reviews - Product",
              },
            ],
          ],
          "source-table": REVIEWS_ID,
        },
      ],
      expressions: {
        Net: [
          "-",
          [
            "field",
            ORDERS.TOTAL,
            {
              "base-type": "type/Float",
            },
          ],
          [
            "field",
            ORDERS.TAX,
            {
              "base-type": "type/Float",
            },
          ],
        ],
      },
      aggregation: [
        ["count"],
        [
          "sum",
          [
            "field",
            ORDERS.TOTAL,
            {
              "base-type": "type/Float",
            },
          ],
        ],
      ],
      breakout: [
        [
          "field",
          ORDERS.CREATED_AT,
          {
            "base-type": "type/DateTime",
            "temporal-unit": "month",
          },
        ],
        [
          "field",
          PRODUCTS.CATEGORY,
          {
            "base-type": "type/Text",
            "source-field": ORDERS.PRODUCT_ID,
          },
        ],
        [
          "field",
          PEOPLE.CREATED_AT,
          {
            "base-type": "type/DateTime",
            "temporal-unit": "year",
            "source-field": ORDERS.USER_ID,
            "original-temporal-unit": "month",
          },
        ],
      ],
    },
    joins: [
      {
        strategy: "left-join",
        alias: "Reviews - Created At: Month",
        condition: [
          "=",
          [
            "field",
            "CREATED_AT",
            {
              "base-type": "type/DateTime",
              "temporal-unit": "month",
              "original-temporal-unit": "month",
            },
          ],
          [
            "field",
            REVIEWS.CREATED_AT,
            {
              "base-type": "type/DateTime",
              "temporal-unit": "month",
              "join-alias": "Reviews - Created At: Month",
              "original-temporal-unit": "month",
            },
          ],
        ],
        "source-table": REVIEWS_ID,
      },
    ],
    expressions: {
      "5 * Count": [
        "*",
        5,
        [
          "field",
          "count",
          {
            "base-type": "type/Integer",
          },
        ],
      ],
    },
    aggregation: [
      ["count"],
      [
        "sum",
        [
          "field",
          REVIEWS.RATING,
          {
            "base-type": "type/Integer",
            "join-alias": "Reviews - Created At: Month",
          },
        ],
      ],
    ],
    breakout: [
      [
        "field",
        "PRODUCTS__via__PRODUCT_ID__CATEGORY",
        {
          "base-type": "type/Text",
        },
      ],
      [
        "field",
        REVIEWS.CREATED_AT,
        {
          "base-type": "type/Text",
          "join-alias": "Reviews - Created At: Month",
        },
      ],
    ],
  };
}
