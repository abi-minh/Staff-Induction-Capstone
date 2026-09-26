/// <reference types="cypress" />

// L6: a location is hidden from staff while draft and appears once published.

describe('L6 · location draft and publish', () => {
  let locationId: number;
  const title = `L6 location ${Date.now()}`;

  before(() => {
    cy.api('POST', 'induction/v1/locations', {
      title,
      status: 'draft',
      address: 'Test Beach',
      lat: -27.3,
      lng: 153.0,
      zoom: 15,
      markers: '[]',
      paths: '[]',
      notes: '',
    }).then(({ body }) => { locationId = body.id; });
  });

  after(() => {
    if (locationId) cy.api('DELETE', `induction/v1/locations/${locationId}`);
  });

  it('hides the draft location from staff', () => {
    // Wait for the list to load before asserting absence, or not.exist passes vacuously.
    cy.intercept('GET', '**/induction/v1/locations*').as('locations');
    cy.visitAs('staff', '/#/portal/locations');
    cy.wait('@locations');
    cy.contains(title).should('not.exist');
  });

  it('shows the location to staff once it is published', () => {
    cy.api('POST', `induction/v1/locations/${locationId}`, { status: 'publish' })
      .its('status').should('eq', 200);

    cy.visitAs('staff', '/#/portal/locations');
    cy.contains(title).should('be.visible');
  });
});
