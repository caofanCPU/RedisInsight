import { t } from 'testcafe';
import { rte } from '../../../helpers/constants';
import {acceptLicenseTerms, deleteDatabase} from '../../../helpers/database';
import { BrowserPage, AddRedisDatabasePage, MyRedisDatabasePage, DatabaseOverviewPage } from '../../../pageObjects';
import { commonUrl, cloudDatabaseConfig } from '../../../helpers/conf';

const browserPage = new BrowserPage();
const addRedisDatabasePage = new AddRedisDatabasePage();
const myRedisDatabasePage = new MyRedisDatabasePage();
const databaseOverviewPage = new DatabaseOverviewPage();

fixture `Overview`
    .meta({ type: 'regression' })
    .page(commonUrl)
    .beforeEach(async() => {
        await acceptLicenseTerms();
        await addRedisDatabasePage.addRedisDataBase(cloudDatabaseConfig);
        //Click for saving
        await t.click(addRedisDatabasePage.addRedisDatabaseButton);
        //Increase timeout to add Cloud DB (due to RI-1993 issue)
        await t.wait(5000);
        //Refresh the page
        await t.eval(() => location.reload(true));
        //Wait for database to be exist
        await t.expect(myRedisDatabasePage.dbNameList.withExactText(cloudDatabaseConfig.databaseName).exists).ok('The existence of the database', { timeout: 5000 });
        await myRedisDatabasePage.clickOnDBByName(cloudDatabaseConfig.databaseName);
    })
    .afterEach(async() => {
        //Delete database
        await deleteDatabase(cloudDatabaseConfig.databaseName);
    });
// Skip due to prod cloud DBs issue https://redislabs.atlassian.net/browse/RI-2793
test.skip
    .meta({ rte: rte.standalone })('Verify that user can see not available metrics from Overview in tooltip with the text "<Metric_name> is/are not available"', async t => {
        //Verify that CPU parameter is not displayed in Overview
        await t.expect(browserPage.overviewCpu.visible).notOk('Not available CPU');
        //Click on More Info icon
        await t.click(databaseOverviewPage.overviewMoreInfo);
        //Check that tooltip was opened
        await t.expect(databaseOverviewPage.overviewTooltip.visible).ok('Overview tooltip');
        //Verify that Database statistics title is displayed in tooltip
        await t.expect(databaseOverviewPage.overviewTooltipStatTitle.visible).ok('Statistics title');
        //Verify that CPU parameter is displayed in tooltip
        await t.expect(browserPage.overviewCpu.find('i').textContent).eql('CPU is not available');
    });
